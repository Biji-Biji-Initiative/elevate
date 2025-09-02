import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { z } from 'zod'

export const runtime = 'nodejs';

const BadgeSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  criteria: z.object({
    type: z.enum(['points', 'submissions', 'activities', 'streak']),
    threshold: z.number().positive(),
    activity_codes: z.array(z.string()).optional(),
    conditions: z.record(z.any()).optional()
  }),
  icon_url: z.string().url().optional()
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    
    const includeStats = searchParams.get('includeStats') === 'true'
    
    const badges = await prisma.badge.findMany({
      include: includeStats ? {
        earned_badges: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                handle: true
              }
            }
          }
        },
        _count: {
          select: {
            earned_badges: true
          }
        }
      } : undefined,
      orderBy: {
        code: 'asc'
      }
    })
    
    return NextResponse.json({ badges })
  } catch (error) {
    console.error('Error fetching badges:', error)
    return createErrorResponse(error, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = await request.json()
    
    const validation = BadgeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const data = validation.data
    
    // Check if badge code already exists
    const existing = await prisma.badge.findUnique({
      where: { code: data.code }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Badge code already exists' },
        { status: 400 }
      )
    }
    
    const badge = await prisma.badge.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        criteria: data.criteria,
        icon_url: data.icon_url
      }
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'CREATE_BADGE',
        target_id: badge.code,
        meta: {
          badgeName: badge.name,
          criteria: badge.criteria
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      badge,
      message: 'Badge created successfully'
    })
    
  } catch (error) {
    console.error('Error creating badge:', error)
    return createErrorResponse(error, 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = await request.json()
    const { code, ...updates } = body
    
    if (!code) {
      return NextResponse.json(
        { error: 'Badge code is required' },
        { status: 400 }
      )
    }
    
    const existing = await prisma.badge.findUnique({
      where: { code }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Badge not found' },
        { status: 404 }
      )
    }
    
    // Validate updates
    const updateSchema = BadgeSchema.partial().omit({ code: true })
    const validation = updateSchema.safeParse(updates)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const badge = await prisma.badge.update({
      where: { code },
      data: validation.data
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'UPDATE_BADGE',
        target_id: code,
        meta: {
          updates: validation.data,
          original: existing
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      badge,
      message: 'Badge updated successfully'
    })
    
  } catch (error) {
    console.error('Error updating badge:', error)
    return createErrorResponse(error, 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.json(
        { error: 'Badge code is required' },
        { status: 400 }
      )
    }
    
    const existing = await prisma.badge.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            earned_badges: true
          }
        }
      }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Badge not found' },
        { status: 404 }
      )
    }
    
    if (existing._count.earned_badges > 0) {
      return NextResponse.json(
        { error: 'Cannot delete badge that has been earned by users' },
        { status: 400 }
      )
    }
    
    await prisma.badge.delete({
      where: { code }
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'DELETE_BADGE',
        target_id: code,
        meta: {
          badgeName: existing.name,
          criteria: existing.criteria
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Badge deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting badge:', error)
    return createErrorResponse(error, 500)
  }
}