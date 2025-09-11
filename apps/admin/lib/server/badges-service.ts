"use server"
import 'server-only'

import { toAdminBadge, type BadgeRow } from '@/lib/server/mappers'
import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { BadgeSchema, AssignBadgeSchema, RemoveBadgeSchema, toPrismaJson, buildAuditMeta } from '@elevate/types'
import type { AdminBadge } from '@elevate/types/admin-api-types'
import { BadgesListResponseSchema, BadgeOperationResponseSchema } from '@elevate/types/admin-api-types'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { handleApiError } from '@/lib/error-utils'
import { recordSLO } from '@/lib/server/obs'
import { AdminError } from '@/lib/server/admin-error'

export async function listBadgesService(includeStats = true): Promise<{ badges: AdminBadge[] }> {
  await requireRole('admin')
  const start = Date.now()
  try {
    const rows = includeStats
      ? await prisma.badge.findMany({
          include: {
            earned_badges: {
              include: { user: { select: { id: true, name: true, handle: true } } },
            },
            _count: { select: { earned_badges: true } },
          },
          orderBy: { code: 'asc' },
        })
      : await prisma.badge.findMany({ orderBy: { code: 'asc' } })
    const badges: AdminBadge[] = (rows as BadgeRow[]).map((b) => toAdminBadge(b, { includeStats }))
    const logger = await getSafeServerLogger('admin-badges')
    logger.info('Listed badges', { includeStats, count: badges.length })
    recordSLO('/admin/service/badges/list', start, 200)
    // Final shape assertion
    const envelope = { success: true as const, data: { badges } }
    const parsed = BadgesListResponseSchema.safeParse(envelope)
    if (!parsed.success) throw new Error('Invalid badges list response shape')
    return { badges }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('List badges failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/list', start, 500)
    throw new Error(handleApiError(err, 'List badges failed'))
  }
}

export async function createBadgeService(body: unknown): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  const start = Date.now()
  try {
    const parsed = BadgeSchema.parse(body)
    const existing = await prisma.badge.findUnique({ where: { code: parsed.code } })
    if (existing) throw new AdminError('DUPLICATE', 'Badge code already exists')
    const badge = await prisma.badge.create({
      data: {
        code: parsed.code,
        name: parsed.name,
        description: parsed.description,
        criteria: toPrismaJson(parsed.criteria) as Prisma.InputJsonValue,
        icon_url: parsed.icon_url ?? null,
      },
    })
    await prisma.auditLog.create({
      data: {
        actor_id: actor.userId,
        action: 'CREATE_BADGE',
        target_id: badge.code,
        meta: buildAuditMeta({ entityType: 'badge', entityId: badge.code }, { badgeName: badge.name, criteria: badge.criteria }) as Prisma.InputJsonValue,
      },
    })
    const logger = await getSafeServerLogger('admin-badges')
    logger.info('Created badge', { code: badge.code })
    recordSLO('/admin/service/badges/create', start, 200)
    // Final shape assertion
    const envelope = { success: true as const, data: { message: 'Badge created successfully' } }
    const parsedEnv = BadgeOperationResponseSchema.safeParse(envelope)
    if (!parsedEnv.success) throw new Error('Invalid badge create response shape')
    return { message: 'Badge created successfully' }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('Create badge failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/create', start, 500)
    throw new Error(handleApiError(err, 'Create badge failed'))
  }
}

export async function updateBadgeService(body: unknown): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  const start = Date.now()
  try {
    if (!body || typeof body !== 'object') throw new Error('Invalid request body')
    const { code, ...rest } = body as Record<string, unknown>
    if (!code || typeof code !== 'string') throw new AdminError('VALIDATION_ERROR', 'Badge code is required')
    const existing = await prisma.badge.findUnique({ where: { code } })
    if (!existing) throw new AdminError('NOT_FOUND', 'Badge not found')
    const updateSchema = BadgeSchema.partial().omit({ code: true })
    const validation = updateSchema.parse(rest)
    const updateData: Prisma.BadgeUpdateInput = {}
    if (validation.name !== undefined) updateData.name = validation.name
    if (validation.description !== undefined) updateData.description = validation.description
    if (validation.icon_url !== undefined) updateData.icon_url = validation.icon_url ?? null
    if (validation.criteria !== undefined) updateData.criteria = toPrismaJson(validation.criteria) as Prisma.InputJsonValue
    await prisma.badge.update({ where: { code }, data: updateData })
    await prisma.auditLog.create({
      data: {
        actor_id: actor.userId,
        action: 'UPDATE_BADGE',
        target_id: code,
        meta: buildAuditMeta({ entityType: 'badge', entityId: code }, { updates: validation, original: existing }) as Prisma.InputJsonValue,
      },
    })
    const logger = await getSafeServerLogger('admin-badges')
    logger.info('Updated badge', { code, changed: Object.keys(updateData) })
    recordSLO('/admin/service/badges/update', start, 200)
    // Final shape assertion
    const envelope = { success: true as const, data: { message: 'Badge updated successfully' } }
    const parsed = BadgeOperationResponseSchema.safeParse(envelope)
    if (!parsed.success) throw new Error('Invalid badge update response shape')
    return { message: 'Badge updated successfully' }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('Update badge failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/update', start, 500)
    throw new Error(handleApiError(err, 'Update badge failed'))
  }
}

export async function deleteBadgeService(code: string): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  const start = Date.now()
  try {
    const existing = await prisma.badge.findUnique({ where: { code }, include: { _count: { select: { earned_badges: true } } } })
    if (!existing) throw new AdminError('NOT_FOUND', 'Badge not found')
    if (existing._count.earned_badges > 0) throw new AdminError('CONFLICT', 'Cannot delete badge that has been earned by users')
    await prisma.badge.delete({ where: { code } })
    await prisma.auditLog.create({
      data: {
        actor_id: actor.userId,
        action: 'DELETE_BADGE',
        target_id: code,
        meta: buildAuditMeta({ entityType: 'badge', entityId: code }, { badgeName: existing.name, criteria: existing.criteria }) as Prisma.InputJsonValue,
      },
    })
    const logger = await getSafeServerLogger('admin-badges')
    logger.info('Deleted badge', { code })
    recordSLO('/admin/service/badges/delete', start, 200)
    // Final shape assertion
    const envelope = { success: true as const, data: { message: 'Badge deleted successfully' } }
    const parsed = BadgeOperationResponseSchema.safeParse(envelope)
    if (!parsed.success) throw new Error('Invalid badge delete response shape')
    return { message: 'Badge deleted successfully' }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('Delete badge failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/delete', start, 500)
    throw new Error(handleApiError(err, 'Delete badge failed'))
  }
}

export async function assignBadgeService(body: unknown): Promise<{ message: string; processed: number; failed: number }> {
  const actor = await requireRole('admin')
  const start = Date.now()
  try {
    const { badgeCode, userIds, reason } = AssignBadgeSchema.parse(body)
    if (!badgeCode || userIds.length === 0) throw new AdminError('VALIDATION_ERROR', 'badgeCode and userIds are required')
    if (userIds.length > 100) throw new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk badge assignment')
    const badge = await prisma.badge.findUnique({ where: { code: badgeCode } })
    if (!badge) throw new AdminError('NOT_FOUND', 'Badge not found')
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } })
    if (users.length === 0) throw new AdminError('NOT_FOUND', 'No valid users found')
  const existingAssignments = await prisma.earnedBadge.findMany({ where: { badge_code: badgeCode, user_id: { in: userIds } } })
  const existingUserIds = new Set(existingAssignments.map((e) => e.user_id))
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id) && users.some((u) => u.id === id))
    if (newUserIds.length === 0) throw new AdminError('CONFLICT', 'All specified users already have this badge')
  const results = await prisma.$transaction(async (tx) => {
    const assignments = [] as Array<{ id: string }>
    for (const userId of newUserIds) {
      const assignment = await tx.earnedBadge.create({ data: { user_id: userId, badge_code: badgeCode, earned_at: new Date() }, select: { id: true } })
      await tx.auditLog.create({
        data: {
          actor_id: actor.userId,
          action: 'ASSIGN_BADGE',
          target_id: userId,
          meta: buildAuditMeta({ entityType: 'badge', entityId: badgeCode }, { badgeCode, badgeName: badge.name, reason, manualAssignment: true }) as Prisma.InputJsonValue,
        },
      })
      assignments.push(assignment)
    }
    return assignments
  })
  const logger = await getSafeServerLogger('admin-badges')
  logger.info('Assigned badge', { badgeCode, processed: results.length, failed: userIds.length - results.length })
    recordSLO('/admin/service/badges/assign', start, 200)
  // Final shape assertion
  const assignPayload = { message: `Badge "${badge.name}" assigned to ${results.length} users`, processed: results.length, failed: userIds.length - results.length }
  const parsed = BadgeOperationResponseSchema.safeParse({ success: true as const, data: assignPayload })
  if (!parsed.success) throw new Error('Invalid badge assign response shape')
  return { message: `Badge "${badge.name}" assigned to ${results.length} users`, processed: results.length, failed: userIds.length - results.length }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('Assign badge failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/assign', start, 500)
    throw new Error(handleApiError(err, 'Assign badge failed'))
  }
}

export async function removeBadgeService(body: unknown): Promise<{ message: string; processed: number; failed: number }> {
  const actor = await requireRole('admin')
  const start = Date.now()
  try {
    const { badgeCode, userIds, reason } = RemoveBadgeSchema.parse(body)
    if (!badgeCode || userIds.length === 0) throw new AdminError('VALIDATION_ERROR', 'badgeCode and userIds are required')
    if (userIds.length > 100) throw new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk badge removal')
  const assignments = await prisma.earnedBadge.findMany({
    where: { badge_code: badgeCode, user_id: { in: userIds } },
    include: { badge: true },
  })
    if (assignments.length === 0) throw new AdminError('NOT_FOUND', 'No badge assignments found for specified users')
  await prisma.$transaction(async (tx) => {
    for (const assignment of assignments) {
      await tx.earnedBadge.delete({ where: { id: assignment.id } })
      await tx.auditLog.create({
        data: {
          actor_id: actor.userId,
          action: 'REMOVE_BADGE',
          target_id: assignment.user_id,
          meta: buildAuditMeta({ entityType: 'badge', entityId: badgeCode }, { badgeName: assignment.badge.name, earnedAt: assignment.earned_at, reason, manualRemoval: true }) as Prisma.InputJsonValue,
        },
      })
    }
  })
  const badgeName = assignments[0]?.badge.name ?? 'Badge'
  const logger = await getSafeServerLogger('admin-badges')
  logger.info('Removed badge', { badgeCode, processed: assignments.length, failed: 0 })
    recordSLO('/admin/service/badges/remove', start, 200)
  // Final shape assertion
  const removePayload = { message: `Badge "${badgeName}" removed from ${assignments.length} users`, processed: assignments.length, failed: 0 }
  const parsed2 = BadgeOperationResponseSchema.safeParse({ success: true as const, data: removePayload })
  if (!parsed2.success) throw new Error('Invalid badge remove response shape')
  return { message: `Badge "${badgeName}" removed from ${assignments.length} users`, processed: assignments.length, failed: 0 }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-badges')
    logger.error('Remove badge failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/badges/remove', start, 500)
    throw new Error(handleApiError(err, 'Remove badge failed'))
  }
}
