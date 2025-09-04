import { type NextRequest, NextResponse } from 'next/server'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { BadgeSchema, toPrismaJson, parseBadgeAuditMeta, buildAuditMeta } from '@elevate/types'
import { z } from 'zod'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { createSuccessResponse } from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    
    const includeStats = searchParams.get('includeStats') === 'true'
    
    // Use separate calls based on includeStats to avoid type inference issues
    const badges = includeStats 
      ? await prisma.badge.findMany({
          include: {
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
          },
          orderBy: {
            code: 'asc'
          }
        })
      : await prisma.badge.findMany({
          orderBy: {
            code: 'asc'
          }
        })
    
    return createSuccessResponse({ badges })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body: unknown = await request.json()
    
    const validation = BadgeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
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
        { success: false, error: 'Badge code already exists' },
        { status: 400 }
      )
    }
    
    const badge = await prisma.badge.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        criteria: toPrismaJson(data.criteria) as Prisma.InputJsonValue,
        icon_url: data.icon_url ?? null
      }
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'CREATE_BADGE',
        target_id: badge.code,
        meta: buildAuditMeta({ entityType: 'badge', entityId: badge.code }, {
          badgeName: badge.name,
          criteria: badge.criteria
        }) as Prisma.InputJsonValue
      }
    })
    
    return createSuccessResponse({ message: 'Badge created successfully' })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body: unknown = await request.json()
    
    // Type-safe extraction of code and updates
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const bodyObj = body as Record<string, unknown>
    const { code, ...updates } = bodyObj
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Badge code is required and must be a string' },
        { status: 400 }
      )
    }
    
    const existing = await prisma.badge.findUnique({
      where: { code }
    })
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Badge not found' },
        { status: 404 }
      )
    }
    
    // Validate updates
    const updateSchema = BadgeSchema.partial().omit({ code: true })
    const validation = updateSchema.safeParse(updates)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    // Build update data object conditionally to avoid passing undefined
    const updateData: Prisma.BadgeUpdateInput = {}
    if (validation.data.name !== undefined) updateData.name = validation.data.name
    if (validation.data.description !== undefined) updateData.description = validation.data.description
    if (validation.data.icon_url !== undefined) updateData.icon_url = validation.data.icon_url ?? null
    if (validation.data.criteria !== undefined) {
      updateData.criteria = toPrismaJson(validation.data.criteria) as Prisma.InputJsonValue
    }
    
    const badge = await prisma.badge.update({
      where: { code },
      data: updateData
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'UPDATE_BADGE',
        target_id: code,
        meta: buildAuditMeta({ entityType: 'badge', entityId: code }, {
          updates: validation.data,
          original: existing
        }) as Prisma.InputJsonValue
      }
    })
    
    return createSuccessResponse({ message: 'Badge updated successfully' })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    const queryObj = Object.fromEntries(searchParams)
    const querySchema = z.object({ code: z.string().min(1) })
    const queryParsed = querySchema.safeParse(queryObj)
    if (!queryParsed.success) {
      return createErrorResponse(new Error('Badge code is required'), 400)
    }
    const { code } = queryParsed.data
    
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
        { success: false, error: 'Badge not found' },
        { status: 404 }
      )
    }
    
    if (existing._count.earned_badges > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete badge that has been earned by users' },
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
        meta: buildAuditMeta({ entityType: 'badge', entityId: code }, {
          badgeName: existing.name,
          criteria: existing.criteria
        }) as Prisma.InputJsonValue
      }
    })
    
    return createSuccessResponse({ message: 'Badge deleted successfully' })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}
