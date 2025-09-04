import { NextResponse, type NextRequest } from 'next/server';

import { requireRole, hasRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { roleToRoleName } from '@elevate/auth'
import type { Role } from '@elevate/db'
import { prisma, type Prisma } from '@elevate/db'
import { parseRole, toPrismaJson, UpdateUserSchema, BulkUpdateUsersSchema, AdminUsersQuerySchema, buildAuditMeta } from '@elevate/types'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    
    const parsedQuery = AdminUsersQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsedQuery.success) {
      return createErrorResponse(new Error('Invalid query'), 400)
    }
    const { search, role, cohort, page, limit, sortBy, sortOrder } = parsedQuery.data
    
    const offset = (page - 1) * limit
    
    const where: Prisma.UserWhereInput = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { school: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (role && role !== 'ALL') {
      const parsedRole = parseRole(role)
      if (parsedRole) {
        where.role = parsedRole
      }
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
          school: true,
          cohort: true,
          created_at: true,
          _count: {
            select: {
              submissions: true,
              ledger: true,
              earned_badges: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: offset,
        take: limit
      }),
      prisma.user.count({ where })
    ])
    
    // Get user totals
    const userIds = users.map(u => u.id)
    const pointTotals = await prisma.pointsLedger.groupBy({
      by: ['user_id'],
      where: {
        user_id: { in: userIds }
      },
      _sum: {
        delta_points: true
      }
    })
    
    const pointsMap = pointTotals.reduce<Record<string, number>>((acc, pt) => {
      acc[pt.user_id] = pt._sum.delta_points || 0
      return acc
    }, {})
    
    const usersWithPoints = users.map(user => ({
      ...user,
      totalPoints: pointsMap[user.id] || 0
    }))
    
    return NextResponse.json({
      success: true,
      data: {
        users: usersWithPoints,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}

export async function PATCH(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const currentUser = await requireRole('admin')
    const body = await request.json()
    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const { userId, role, school, cohort, name, handle } = parsed.data
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }
    
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Role change validation
    if (role && role !== targetUser.role) {
      // Prevent non-superadmins from creating/modifying admins or superadmins
      if (currentUser.role !== 'superadmin') {
        const restrictedRoles = ['ADMIN', 'SUPERADMIN']
        if (restrictedRoles.includes(role) || restrictedRoles.includes(targetUser.role)) {
          return NextResponse.json(
            { success: false, error: 'Insufficient permissions to modify admin roles' },
            { status: 403 }
          )
        }
      }
      
      // Prevent self-demotion  
      const parsedNewRole = parseRole(role)
      if (currentUser.userId === userId && parsedNewRole && !hasRole(currentUser.role, roleToRoleName(parsedNewRole))) {
        return NextResponse.json(
          { success: false, error: 'Cannot demote your own role' },
          { status: 403 }
        )
      }
    }
    
    // Handle uniqueness validation
    const updateData: Partial<{ name: string; email: string; handle: string; school: string | null; cohort: string | null; role: Role }> = {}
    
    if (name !== undefined) updateData.name = name
    if (school !== undefined) updateData.school = school
    if (cohort !== undefined) updateData.cohort = cohort
    if (role !== undefined) updateData.role = role
    
    if (handle !== undefined && handle !== targetUser.handle) {
      // Check if handle is already taken
      const existingHandle = await prisma.user.findUnique({
        where: { handle }
      })
      
      if (existingHandle && existingHandle.id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Handle is already taken' },
          { status: 400 }
        )
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
        created_at: true
      }
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: currentUser.userId,
        action: 'UPDATE_USER',
        target_id: userId,
        meta: buildAuditMeta({ entityType: 'user', entityId: userId }, {
          changes: updateData,
          originalRole: targetUser.role,
          newRole: role
        }) as Prisma.InputJsonValue
      }
    })
    
    return createSuccessResponse({ message: 'User updated successfully', user: updatedUser })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}

// Bulk role updates
export async function POST(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const currentUser = await requireRole('admin')
    const body = await request.json()
    const parsed = BulkUpdateUsersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const { userIds, role } = parsed.data
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds array is required' },
        { status: 400 }
      )
    }
    
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'role is required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 users per bulk operation' },
        { status: 400 }
      )
    }
    
    // Role validation
    if (currentUser.role !== 'superadmin') {
      const restrictedRoles = ['ADMIN', 'SUPERADMIN']
      if (restrictedRoles.includes(role)) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions to assign admin roles' },
          { status: 403 }
        )
      }
    }
    
    // Prevent self-demotion in bulk
    const parsedBulkRole = parseRole(role)
    if (userIds.includes(currentUser.userId) && parsedBulkRole && !hasRole(currentUser.role, roleToRoleName(parsedBulkRole))) {
      return NextResponse.json(
        { success: false, error: 'Cannot demote your own role in bulk operation' },
        { status: 403 }
      )
    }
    
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        role: true
      }
    })
    
    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No users found' },
        { status: 404 }
      )
    }
    
    // Additional validation for existing admin users
    if (currentUser.role !== 'superadmin') {
      const hasRestrictedUsers = users.some(user => 
        ['ADMIN', 'SUPERADMIN'].includes(user.role)
      )
      
      if (hasRestrictedUsers) {
        return NextResponse.json(
          { success: false, error: 'Cannot modify admin users without superadmin role' },
          { status: 403 }
        )
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
              role: true
            }
          })
          
          // Create audit log
          await tx.auditLog.create({
            data: {
              actor_id: currentUser.userId,
              action: 'UPDATE_USER_ROLE',
              target_id: user.id,
              meta: buildAuditMeta({ entityType: 'user', entityId: user.id }, {
                originalRole: user.role,
                newRole: role,
                bulkOperation: true
              }) as Prisma.InputJsonValue
            }
          })
          
          updates.push(updated)
        }
      }
      
      return updates
    })
    
    return createSuccessResponse({ processed: results.length, failed: 0, errors: [] })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}
