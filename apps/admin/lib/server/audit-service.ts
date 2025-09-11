"use server"
import 'server-only'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'

export type AuditQuery = {
  targetId?: string
  actorId?: string
  action?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export type AuditLogDTO = {
  id: string
  actor_id: string
  action: string
  target_id: string | null
  created_at: string
  meta?: unknown
}

export async function listAuditLogsService(params: AuditQuery): Promise<{ logs: AuditLogDTO[] }> {
  await requireRole('admin')
  const { targetId, actorId, action, startDate, endDate } = params
  const limit = params.limit ?? 100
  const offset = params.offset ?? 0

  const where: Prisma.AuditLogWhereInput = {}
  if (targetId) where.target_id = targetId
  if (actorId) where.actor_id = actorId
  if (action) where.action = action
  if (startDate || endDate) {
    const gte = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined
    const lt = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined
    where.created_at = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) }
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  })

  return {
    logs: rows.map((r) => ({
      id: r.id,
      actor_id: r.actor_id,
      action: r.action,
      target_id: r.target_id,
      created_at: r.created_at.toISOString(),
      meta: r.meta ?? undefined,
    })),
  }
}
