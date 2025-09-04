import { type NextRequest, NextResponse } from 'next/server'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { AssignBadgeSchema, RemoveBadgeSchema, buildAuditMeta } from '@elevate/types'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('admin')
    const body: unknown = await request.json()
    const parsed = AssignBadgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const { badgeCode, userIds, reason } = parsed.data
    
    if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'badgeCode and userIds array are required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 users per bulk badge assignment' },
        { status: 400 }
      )
    }
    
    // Verify badge exists
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode }
    })
    
    if (!badge) {
      return NextResponse.json(
        { success: false, error: 'Badge not found' },
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
        { success: false, error: 'No valid users found' },
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
        { success: false, error: 'All specified users already have this badge' },
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
            meta: buildAuditMeta({ entityType: 'badge', entityId: badgeCode }, {
              badgeCode,
              badgeName: badge.name,
              reason,
              manualAssignment: true
            }) as Prisma.InputJsonValue
          }
        })
        
        assignments.push(assignment)
      }
      
      return assignments
    })
    
    return NextResponse.json({ success: true, data: { message: `Badge "${badge.name}" assigned to ${results.length} users`, processed: results.length, failed: userIds.length - results.length } })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}

// Remove badge from users
export async function DELETE(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('admin')
    const body: unknown = await request.json()
    const parsed = RemoveBadgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
    const { badgeCode, userIds, reason } = parsed.data
    
    if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'badgeCode and userIds array are required' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations
    if (userIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 users per bulk badge removal' },
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
        { success: false, error: 'No badge assignments found for specified users' },
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
            meta: buildAuditMeta({ entityType: 'badge', entityId: badgeCode }, {
              badgeCode,
              badgeName: assignment.badge.name,
              reason,
              earnedAt: assignment.earned_at
            }) as Prisma.InputJsonValue
          }
        })
      }
    })
    
    // We already checked assignments.length === 0 above, but TypeScript needs this check
    const badgeName = assignments[0]?.badge.name ?? 'Unknown Badge'
    
    return NextResponse.json({ success: true, data: { message: `Badge "${badgeName}" removed from ${assignments.length} users`, processed: assignments.length, failed: 0 } })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}
