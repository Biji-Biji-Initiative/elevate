"use server"
import 'server-only'

import { toAdminUser, type AdminUserRow } from '@/lib/server/mappers'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { roleToRoleName } from '@elevate/auth'
import { requireRole, hasRole } from '@elevate/auth/server-helpers'
import { prisma, findUserById, findUserByHandle, type Prisma } from '@elevate/db'
import { parseRole } from '@elevate/types'
import type { AdminUser, Pagination } from '@elevate/types/admin-api-types'
// SLO metrics are recorded via recordSLO helper
import { recordSLO } from '@/lib/server/obs'
import { AdminError } from '@/lib/server/admin-error'

export type ListUsersParams = {
  search?: string
  role?: string | 'ALL'
  userType?: 'EDUCATOR' | 'STUDENT' | 'ALL'
  cohort?: string | 'ALL'
  page: number
  limit: number
  sortBy: 'created_at' | 'name' | 'email'
  sortOrder: 'asc' | 'desc'
}

export async function listUsersService(params: ListUsersParams): Promise<{ users: AdminUser[]; pagination: Pagination }> {
  await requireRole('admin')
  const logger = await getSafeServerLogger('admin-users')
  const { search, role, userType, cohort, page, limit, sortBy, sortOrder } = params

  const offset = (page - 1) * limit
  const where: Prisma.UserWhereInput = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { handle: { contains: search, mode: 'insensitive' } },
      { school: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (role && role !== 'ALL') {
    const parsedRole = parseRole(role)
    if (parsedRole) where.role = parsedRole
  }

  if (userType && userType !== 'ALL') where.user_type = userType
  if (cohort && cohort !== 'ALL') where.cohort = cohort

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        avatar_url: true,
        role: true,
        user_type: true,
        user_type_confirmed: true,
        kajabi_contact_id: true,
        school: true,
        cohort: true,
        created_at: true,
        _count: {
          select: {
            submissions: true,
            ledger: true,
            earned_badges: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  const userIds = users.map((u) => u.id)
  const pointTotals = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    where: { user_id: { in: userIds } },
    _sum: { delta_points: true },
  })
  const pointsMap = pointTotals.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.user_id] = pt._sum.delta_points || 0
    return acc
  }, {})

  const mapped: AdminUser[] = (users as AdminUserRow[]).map((u) => toAdminUser(u, pointsMap[u.id] || 0))
  logger.info('Listed users', { page, limit, sortBy, sortOrder, filter: { search, role, userType, cohort }, returned: mapped.length })
  // Metrics recorded via API routes; skip at service layer to reduce coupling

  return {
    users: mapped,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

export async function updateUserService(body: {
  userId: string
  role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  school?: string | null
  cohort?: string | null
  name?: string
  handle?: string
}) {
  const currentUser = await requireRole('admin')
  const start = Date.now()
  const { userId, role, school, cohort, name, handle } = body

  if (!userId) throw new AdminError('VALIDATION_ERROR', 'userId is required')

  const targetUser = await findUserById(userId)
  if (!targetUser) throw new AdminError('NOT_FOUND', 'User not found')

  if (role && role !== targetUser.role) {
    if (currentUser.role !== 'superadmin') {
      const restricted = ['ADMIN', 'SUPERADMIN']
      if (restricted.includes(role) || restricted.includes(targetUser.role)) {
        throw new AdminError('FORBIDDEN', 'Insufficient permissions to modify admin roles')
      }
    }
    const parsedNewRole = parseRole(role)
    if (
      currentUser.userId === userId &&
      parsedNewRole &&
      !hasRole(currentUser.role, roleToRoleName(parsedNewRole))
    ) {
      throw new AdminError('FORBIDDEN', 'Cannot demote your own role')
    }
  }

  const updateData: {
    name?: string
    email?: string
    handle?: string
    school?: string | null
    cohort?: string | null
    role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  } = {}

  if (name !== undefined) updateData.name = name
  if (school !== undefined) updateData.school = school
  if (cohort !== undefined) updateData.cohort = cohort
  if (role !== undefined) updateData.role = role

  if (handle !== undefined && handle !== targetUser.handle) {
    const existingHandle = await findUserByHandle(handle)
    if (existingHandle && existingHandle.id !== userId) {
      throw new AdminError('DUPLICATE', 'Handle is already taken')
    }
    updateData.handle = handle
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      handle: true,
      name: true,
      email: true,
      avatar_url: true,
      role: true,
      user_type: true,
      user_type_confirmed: true,
      kajabi_contact_id: true,
      school: true,
      cohort: true,
      created_at: true,
      _count: { select: { submissions: true, ledger: true, earned_badges: true } },
    },
  })

  const totalPointsAgg = await prisma.pointsLedger.aggregate({ where: { user_id: userId }, _sum: { delta_points: true } })
  const totalPoints = totalPointsAgg._sum.delta_points ?? 0
  const userDto = toAdminUser(updated as AdminUserRow, totalPoints)
  const audit = await getSafeServerLogger('admin-users')
  audit.info('Updated user', { userId, changed: Object.keys(updateData) })
  recordSLO('/admin/service/users/update', start, 200)
  return { message: 'User updated successfully', user: userDto }
}

export async function bulkUpdateUsersService(body: {
  userIds: string[]
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
}) {
  const currentUser = await requireRole('admin')
  const { userIds, role } = body

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AdminError('VALIDATION_ERROR', 'userIds array is required')
  }
  if (!role) throw new AdminError('VALIDATION_ERROR', 'role is required')
  if (userIds.length > 100) throw new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk operation')

  if (currentUser.role !== 'superadmin') {
    const restricted = ['ADMIN', 'SUPERADMIN']
    if (restricted.includes(role)) throw new AdminError('FORBIDDEN', 'Insufficient permissions to assign admin roles')
  }

  const parsedBulkRole = parseRole(role)
  if (
    userIds.includes(currentUser.userId) &&
    parsedBulkRole &&
    !hasRole(currentUser.role, roleToRoleName(parsedBulkRole))
  ) {
    throw new AdminError('FORBIDDEN', 'Cannot demote your own role in bulk operation')
  }

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } })
  if (users.length === 0) throw new AdminError('NOT_FOUND', 'No users found')
  if (currentUser.role !== 'superadmin') {
    const hasRestricted = users.some((u) => ['ADMIN', 'SUPERADMIN'].includes(u.role))
    if (hasRestricted) throw new AdminError('FORBIDDEN', 'Cannot modify admin users without superadmin role')
  }

  const start = Date.now()
  const results = await prisma.$transaction(async (tx) => {
    const updates: Array<{ id: string }> = []
    for (const user of users) {
      if (user.role !== role) {
        await tx.user.update({ where: { id: user.id }, data: { role } })
        updates.push({ id: user.id })
      }
    }
    return updates
  })
  const logger2 = await getSafeServerLogger('admin-users')
  logger2.info('Bulk role update', { role, processed: results.length })
  const { recordSLO } = await import('@/lib/server/obs')
  recordSLO('/admin/service/users/bulk-update', start, 200)
  return { processed: results.length, failed: 0, errors: [] as Array<{ userId: string; error: string }> }
}

export async function bulkUpdateLeapsUsersService(body: {
  userIds: string[]
  userType?: 'EDUCATOR' | 'STUDENT'
  userTypeConfirmed?: boolean
  school?: string
  region?: string
}) {
  await requireRole('admin')
  const { userIds, userType, userTypeConfirmed, school, region } = body
  if (!Array.isArray(userIds) || userIds.length === 0) throw new AdminError('VALIDATION_ERROR', 'userIds array is required')
  const results = { processed: 0, failed: 0, errors: [] as Array<{ userId: string; error: string }> }
  const client = (await import('@clerk/nextjs/server')).clerkClient
  const start = Date.now()
  for (const id of userIds) {
    try {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(userType ? { user_type: userType } : {}),
          ...(typeof userTypeConfirmed === 'boolean' ? { user_type_confirmed: userTypeConfirmed } : {}),
          ...(school !== undefined ? { school } : {}),
          ...(region !== undefined ? { region } : {}),
        },
        select: { id: true },
      })
      if (userType) {
        try {
          const c = await client()
          await c.users.updateUser(updated.id, { publicMetadata: { user_type: userType } })
        } catch (e) {
          const logger = await (await import('@elevate/logging/safe-server')).getSafeServerLogger('admin-users-leaps-bulk')
          logger.warn('Clerk mirror failed for user', { id, error: e instanceof Error ? e.message : String(e) })
        }
      }
      results.processed += 1
    } catch (e) {
      results.failed += 1
      results.errors.push({ userId: id, error: e instanceof Error ? e.message : String(e) })
    }
  }
  const log = await getSafeServerLogger('admin-users')
  log.info('Bulk LEAPS update', { processed: results.processed, failed: results.failed })
  const { recordSLO } = await import('@/lib/server/obs')
  recordSLO('/admin/service/users/bulk-leaps', start, 200)
  return results
}

export async function getUserLeapsProfileService(id: string): Promise<{
  id: string
  email: string
  name?: string | null
  handle?: string | null
  user_type: 'EDUCATOR' | 'STUDENT'
  user_type_confirmed: boolean
  school?: string | null
  region?: string | null
}> {
  await requireRole('admin')
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      handle: true,
      user_type: true,
      user_type_confirmed: true,
      school: true,
      region: true,
    },
  })
  if (!u) throw new AdminError('NOT_FOUND', 'User not found')
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    handle: u.handle,
    user_type: (u.user_type ?? 'STUDENT') as 'EDUCATOR' | 'STUDENT',
    user_type_confirmed: Boolean(u.user_type_confirmed),
    school: u.school ?? null,
    region: (u as { region?: string | null }).region ?? null,
  }
}
