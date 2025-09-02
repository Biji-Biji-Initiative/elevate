import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole, hasRole } from '@elevate/auth/withRole'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const cohort = searchParams.get('cohort')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    const offset = (page - 1) * limit
    
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { school: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (role && role !== 'ALL') {
      where.role = role
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
    
    const pointsMap = pointTotals.reduce((acc, pt) => {
      acc[pt.user_id] = pt._sum.delta_points || 0
      return acc
    }, {} as Record<string, number>)
    
    const usersWithPoints = users.map(user => ({
      ...user,
      totalPoints: pointsMap[user.id] || 0
    }))
    
    return NextResponse.json({
      users: usersWithPoints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: error.statusCode || 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireRole('admin')
    const body = await request.json()
    const { userId, role, school, cohort, name, handle } = body
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }
    
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
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
            { error: 'Insufficient permissions to modify admin roles' },
            { status: 403 }
          )
        }
      }
      
      // Prevent self-demotion
      if (currentUser.userId === userId && !hasRole(role.toLowerCase() as any, currentUser.role)) {
        return NextResponse.json(
          { error: 'Cannot demote your own role' },
          { status: 403 }
        )
      }
    }
    
    // Handle uniqueness validation
    const updateData: any = {}
    
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
          { error: 'Handle is already taken' },
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
        meta: {
          changes: updateData,
          originalRole: targetUser.role,
          newRole: role
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    })
    
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: error.statusCode || 500 }
    )
  }
}

// Bulk role updates
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireRole('admin')
    const body = await request.json()
    const { userIds, role } = body
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      )
    }
    
    if (!role) {
      return NextResponse.json(
        { error: 'role is required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 users per bulk operation' },
        { status: 400 }
      )
    }
    
    // Role validation
    if (currentUser.role !== 'superadmin') {
      const restrictedRoles = ['ADMIN', 'SUPERADMIN']
      if (restrictedRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions to assign admin roles' },
          { status: 403 }
        )
      }
    }
    
    // Prevent self-demotion in bulk
    if (userIds.includes(currentUser.userId) && !hasRole(role.toLowerCase() as any, currentUser.role)) {
      return NextResponse.json(
        { error: 'Cannot demote your own role in bulk operation' },
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
        { error: 'No users found' },
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
          { error: 'Cannot modify admin users without superadmin role' },
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
              meta: {
                originalRole: user.role,
                newRole: role,
                bulkOperation: true
              }
            }
          })
          
          updates.push(updated)
        }
      }
      
      return updates
    })
    
    return NextResponse.json({
      success: true,
      updated: results.length,
      users: results,
      message: `${results.length} users updated to ${role} role`
    })
    
  } catch (error: any) {
    console.error('Error bulk updating users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk update users' },
      { status: error.statusCode || 500 }
    )
  }
}