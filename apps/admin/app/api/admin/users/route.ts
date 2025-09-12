import type { NextRequest } from 'next/server'

// zod used via AdminUsersQuerySchema; no direct z reference needed here

import { roleToRoleName } from '@elevate/auth'
import { requireRole, hasRole } from '@elevate/auth/server-helpers'
import {
  findUserById,
  findUserByHandle,
  prisma, // Still need for complex queries and transactions
  type Prisma,
} from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { parseRole, toPrismaJson, UpdateUserSchema, BulkUpdateUsersSchema, AdminUsersQuerySchema, buildAuditMeta } from '@elevate/types'
import type { AdminUsersQuery } from '@elevate/types'
import type { Role } from '@elevate/types/common'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const logger = await getSafeServerLogger('admin-users')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      await requireRole('admin')
      const { searchParams } = new URL(request.url)

      const parsedQuery = AdminUsersQuerySchema.safeParse(
        Object.fromEntries(searchParams),
      )
      if (!parsedQuery.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid query'))
      }
      const q = parsedQuery.data as AdminUsersQuery & { kajabi?: 'ALL' | 'LINKED' | 'UNLINKED' }
      const sp = new URL(request.url).searchParams
      const search = q.search ?? ''
      const role = q.role ?? 'ALL'
      const userType = (sp.get('userType') as 'ALL' | 'EDUCATOR' | 'STUDENT' | null) ?? 'ALL'
      const kajabi = (sp.get('kajabi') as 'ALL' | 'LINKED' | 'UNLINKED' | null) ?? 'ALL'
      const cohort = q.cohort ?? 'ALL'
      const page = q.page ?? 1
      const limit = q.limit ?? 50
      const sortBy = q.sortBy ?? 'created_at'
      const sortOrder = q.sortOrder ?? 'desc'

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
        if (parsedRole) {
          where.role = parsedRole
        }
      }

      if (userType && userType !== 'ALL') {
        where.user_type = userType as 'EDUCATOR' | 'STUDENT'
      }

      if (kajabi && kajabi !== 'ALL') {
        where.kajabi_contact_id = kajabi === 'LINKED' ? { not: null } : null
      }

      if (cohort && cohort !== 'ALL') {
        where.cohort = cohort
      }

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
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: offset,
          take: limit,
        }),
        prisma.user.count({ where }),
      ])

      // Get user totals
      const userIds = users.map((u) => u.id)
      const pointTotals = await prisma.pointsLedger.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: userIds },
        },
        _sum: {
          delta_points: true,
        },
      })

      const pointsMap = pointTotals.reduce<Record<string, number>>(
        (acc, pt) => {
          acc[pt.user_id] = pt._sum.delta_points || 0
          return acc
        },
        {},
      )

      const usersList = users.map((u) => ({
        ...u,
        totalPoints: pointsMap[u.id] || 0,
      }))

      return toSuccessResponse({
        users: usersList,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error(
        'Admin users GET failed',
        error instanceof Error ? error : new Error(String(error)),
      )
      return toErrorResponse(error)
    }
  })
}

export async function PATCH(request: NextRequest) {
  const logger = await getSafeServerLogger('admin-users')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      const currentUser = await requireRole('admin')
      const body = await request.json()
      const parsed = UpdateUserSchema.safeParse(body)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
      }
      const { userId, role, school, cohort, name, handle } = parsed.data

      if (!userId) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'userId is required'))
      }

      const targetUser = await findUserById(userId)

      if (!targetUser) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'User not found'))
      }

      // Role change validation
      if (role && role !== targetUser.role) {
        // Prevent non-superadmins from creating/modifying admins or superadmins
        if (currentUser.role !== 'superadmin') {
          const restrictedRoles = ['ADMIN', 'SUPERADMIN']
          if (
            restrictedRoles.includes(role) ||
            restrictedRoles.includes(targetUser.role)
          ) {
            return toErrorResponse(new AdminError('FORBIDDEN', 'Insufficient permissions to modify admin roles'))
          }
        }

        // Prevent self-demotion
        const parsedNewRole = parseRole(role)
        if (
          currentUser.userId === userId &&
          parsedNewRole &&
          !hasRole(currentUser.role, roleToRoleName(parsedNewRole))
        ) {
          return toErrorResponse(new AdminError('FORBIDDEN', 'Cannot demote your own role'))
        }
      }

      // Handle uniqueness validation
      const updateData: Partial<{
        name: string
        email: string
        handle: string
        school: string | null
        cohort: string | null
        role: Role
      }> = {}

      if (name !== undefined) updateData.name = name
      if (school !== undefined) updateData.school = school
      if (cohort !== undefined) updateData.cohort = cohort
      if (role !== undefined) updateData.role = role

      if (handle !== undefined && handle !== targetUser.handle) {
        // Check if handle is already taken
        const existingHandle = await findUserByHandle(handle)

        if (existingHandle && existingHandle.id !== userId) {
          return toErrorResponse(new AdminError('DUPLICATE', 'Handle is already taken'))
        }

        updateData.handle = handle
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          handle: true,
          name: true,
          email: true,
          avatar_url: true,
          role: true,
          school: true,
          cohort: true,
          created_at: true,
        },
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          actor_id: currentUser.userId,
          action: 'UPDATE_USER',
          target_id: userId,
          meta: toPrismaJson(
            buildAuditMeta(
              { entityType: 'user', entityId: userId },
              {
                changes: updateData,
                originalRole: targetUser.role,
                newRole: role,
              },
            ),
          ) as Prisma.InputJsonValue,
        },
      })

      return toSuccessResponse({
        message: 'User updated successfully',
        user: updatedUser,
      })
    } catch (error) {
      logger.error(
        'Admin users PATCH failed',
        error instanceof Error ? error : new Error(String(error)),
      )
      return toErrorResponse(error)
    }
  })
}

// Bulk role updates
export async function POST(request: NextRequest) {
  const logger = await getSafeServerLogger('admin-users')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      const currentUser = await requireRole('admin')
      const body = await request.json()
      const parsed = BulkUpdateUsersSchema.safeParse(body)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
      }
      const { userIds, role } = parsed.data

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'userIds array is required'))
      }

      if (!role) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'role is required'))
      }

      // Limit bulk operations
      if (userIds.length > 100) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk operation'))
      }

      // Role validation
      if (currentUser.role !== 'superadmin') {
        const restrictedRoles = ['ADMIN', 'SUPERADMIN']
        if (restrictedRoles.includes(role)) {
          return toErrorResponse(new AdminError('FORBIDDEN', 'Insufficient permissions to assign admin roles'))
        }
      }

      // Prevent self-demotion in bulk
      const parsedBulkRole = parseRole(role)
      if (
        userIds.includes(currentUser.userId) &&
        parsedBulkRole &&
        !hasRole(currentUser.role, roleToRoleName(parsedBulkRole))
      ) {
        return toErrorResponse(new AdminError('FORBIDDEN', 'Cannot demote your own role in bulk operation'))
      }

      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          role: true,
        },
      })

      if (users.length === 0) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'No users found'))
      }

      // Additional validation for existing admin users
      if (currentUser.role !== 'superadmin') {
        const hasRestrictedUsers = users.some((user) =>
          ['ADMIN', 'SUPERADMIN'].includes(user.role),
        )

        if (hasRestrictedUsers) {
          return toErrorResponse(new AdminError('FORBIDDEN', 'Cannot modify admin users without superadmin role'))
        }
      }

      const results = await prisma.$transaction(async (tx) => {
        const updates = []

        for (const user of users) {
          if (user.role !== role) {
            const updated = await tx.user.update({
              where: { id: user.id },
              data: { role },
              select: {
                id: true,
                handle: true,
                name: true,
                email: true,
                role: true,
              },
            })

            // Create audit log
            await tx.auditLog.create({
              data: {
                actor_id: currentUser.userId,
                action: 'UPDATE_USER_ROLE',
                target_id: user.id,
                meta: toPrismaJson(
                  buildAuditMeta(
                    { entityType: 'user', entityId: user.id },
                    {
                      originalRole: user.role,
                      newRole: role,
                      bulkOperation: true,
                    },
                  ),
                ) as Prisma.InputJsonValue,
              },
            })

            updates.push(updated)
          }
        }

        return updates
      })

      return toSuccessResponse({
        processed: results.length,
        failed: 0,
        errors: [],
      })
    } catch (error) {
      logger.error(
        'Admin users POST failed',
        error instanceof Error ? error : new Error(String(error)),
      )
      return toErrorResponse(error)
    }
  })
}
