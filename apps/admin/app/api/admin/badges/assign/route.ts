import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole } from '@elevate/auth/withRole'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = await request.json()
    const { badgeCode, userIds, reason } = body
    
    if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'badgeCode and userIds array are required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 users per bulk badge assignment' },
        { status: 400 }
      )
    }
    
    // Verify badge exists
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode }
    })
    
    if (!badge) {
      return NextResponse.json(
        { error: 'Badge not found' },
        { status: 404 }
      )
    }
    
    // Verify users exist
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        handle: true
      }
    })
    
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found' },
        { status: 404 }
      )
    }
    
    // Check for existing badge assignments
    const existingAssignments = await prisma.earnedBadge.findMany({
      where: {
        badge_code: badgeCode,
        user_id: { in: userIds }
      }
    })
    
    const existingUserIds = new Set(existingAssignments.map(eb => eb.user_id))
    const newUserIds = userIds.filter(id => !existingUserIds.has(id) && users.some(u => u.id === id))
    
    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: 'All specified users already have this badge' },
        { status: 400 }
      )
    }
    
    const results = await prisma.$transaction(async (tx) => {
      const assignments = []
      
      for (const userId of newUserIds) {
        const assignment = await tx.earnedBadge.create({
          data: {
            user_id: userId,
            badge_code: badgeCode,
            earned_at: new Date()
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                handle: true
              }
            },
            badge: true
          }
        })
        
        // Create audit log
        await tx.auditLog.create({
          data: {
            actor_id: user.userId,
            action: 'ASSIGN_BADGE',
            target_id: userId,
            meta: {
              badgeCode,
              badgeName: badge.name,
              reason,
              manualAssignment: true
            }
          }
        })
        
        assignments.push(assignment)
      }
      
      return assignments
    })
    
    return NextResponse.json({
      success: true,
      assigned: results.length,
      skipped: userIds.length - results.length,
      assignments: results,
      message: `Badge "${badge.name}" assigned to ${results.length} users`
    })
    
  } catch (error: any) {
    console.error('Error assigning badges:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign badges' },
      { status: error.statusCode || 500 }
    )
  }
}

// Remove badge from users
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = await request.json()
    const { badgeCode, userIds, reason } = body
    
    if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'badgeCode and userIds array are required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 users per bulk badge removal' },
        { status: 400 }
      )
    }
    
    // Find existing assignments
    const assignments = await prisma.earnedBadge.findMany({
      where: {
        badge_code: badgeCode,
        user_id: { in: userIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true
          }
        },
        badge: true
      }
    })
    
    if (assignments.length === 0) {
      return NextResponse.json(
        { error: 'No badge assignments found for specified users' },
        { status: 404 }
      )
    }
    
    await prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.earnedBadge.delete({
          where: {
            id: assignment.id
          }
        })
        
        // Create audit log
        await tx.auditLog.create({
          data: {
            actor_id: user.userId,
            action: 'REMOVE_BADGE',
            target_id: assignment.user_id,
            meta: {
              badgeCode,
              badgeName: assignment.badge.name,
              reason,
              earnedAt: assignment.earned_at
            }
          }
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      removed: assignments.length,
      message: `Badge "${assignments[0].badge.name}" removed from ${assignments.length} users`
    })
    
  } catch (error: any) {
    console.error('Error removing badges:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove badges' },
      { status: error.statusCode || 500 }
    )
  }
}