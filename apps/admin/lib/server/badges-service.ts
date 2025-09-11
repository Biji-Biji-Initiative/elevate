"use server"
import 'server-only'

import { toAdminBadge, type BadgeRow } from '@/lib/server/mappers'
import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { BadgeSchema, AssignBadgeSchema, RemoveBadgeSchema, toPrismaJson, buildAuditMeta } from '@elevate/types'
import type { AdminBadge } from '@elevate/types/admin-api-types'

export async function listBadgesService(includeStats = true): Promise<{ badges: AdminBadge[] }> {
  await requireRole('admin')
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
  return { badges }
}

export async function createBadgeService(body: unknown): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  const parsed = BadgeSchema.parse(body)
  const existing = await prisma.badge.findUnique({ where: { code: parsed.code } })
  if (existing) throw new Error('Badge code already exists')
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
  return { message: 'Badge created successfully' }
}

export async function updateBadgeService(body: unknown): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  if (!body || typeof body !== 'object') throw new Error('Invalid request body')
  const { code, ...rest } = body as Record<string, unknown>
  if (!code || typeof code !== 'string') throw new Error('Badge code is required')
  const existing = await prisma.badge.findUnique({ where: { code } })
  if (!existing) throw new Error('Badge not found')
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
  return { message: 'Badge updated successfully' }
}

export async function deleteBadgeService(code: string): Promise<{ message: string }> {
  const actor = await requireRole('admin')
  const existing = await prisma.badge.findUnique({ where: { code }, include: { _count: { select: { earned_badges: true } } } })
  if (!existing) throw new Error('Badge not found')
  if (existing._count.earned_badges > 0) throw new Error('Cannot delete badge that has been earned by users')
  await prisma.badge.delete({ where: { code } })
  await prisma.auditLog.create({
    data: {
      actor_id: actor.userId,
      action: 'DELETE_BADGE',
      target_id: code,
      meta: buildAuditMeta({ entityType: 'badge', entityId: code }, { badgeName: existing.name, criteria: existing.criteria }) as Prisma.InputJsonValue,
    },
  })
  return { message: 'Badge deleted successfully' }
}

export async function assignBadgeService(body: unknown): Promise<{ message: string; processed: number; failed: number }> {
  const actor = await requireRole('admin')
  const { badgeCode, userIds, reason } = AssignBadgeSchema.parse(body)
  if (!badgeCode || userIds.length === 0) throw new Error('badgeCode and userIds are required')
  if (userIds.length > 100) throw new Error('Maximum 100 users per bulk badge assignment')
  const badge = await prisma.badge.findUnique({ where: { code: badgeCode } })
  if (!badge) throw new Error('Badge not found')
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } })
  if (users.length === 0) throw new Error('No valid users found')
  const existingAssignments = await prisma.earnedBadge.findMany({ where: { badge_code: badgeCode, user_id: { in: userIds } } })
  const existingUserIds = new Set(existingAssignments.map((e) => e.user_id))
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id) && users.some((u) => u.id === id))
  if (newUserIds.length === 0) throw new Error('All specified users already have this badge')
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
  return { message: `Badge "${badge.name}" assigned to ${results.length} users`, processed: results.length, failed: userIds.length - results.length }
}

export async function removeBadgeService(body: unknown): Promise<{ message: string; processed: number; failed: number }> {
  const actor = await requireRole('admin')
  const { badgeCode, userIds, reason } = RemoveBadgeSchema.parse(body)
  if (!badgeCode || userIds.length === 0) throw new Error('badgeCode and userIds are required')
  if (userIds.length > 100) throw new Error('Maximum 100 users per bulk badge removal')
  const assignments = await prisma.earnedBadge.findMany({
    where: { badge_code: badgeCode, user_id: { in: userIds } },
    include: { badge: true },
  })
  if (assignments.length === 0) throw new Error('No badge assignments found for specified users')
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
  return { message: `Badge "${badgeName}" removed from ${assignments.length} users`, processed: assignments.length, failed: 0 }
}
