import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const AuditQuerySchema = z.object({
  targetId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext): Promise<NextResponse> => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const start = Date.now()
    const baseLogger = await getSafeServerLogger('admin-audit')
    const logger = createRequestLogger(baseLogger, request)
    try {
      const { searchParams } = new URL(request.url)
      const parsed = AuditQuerySchema.safeParse(Object.fromEntries(searchParams))
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid query'))
      }
      const { targetId, actorId, action, startDate, endDate, page, limit } = parsed.data
      const offset = (page - 1) * limit
      const where: any = {}
      if (targetId) where.target_id = targetId
      if (actorId) where.actor_id = actorId
      if (action) where.action = action
      if (startDate || endDate) {
        const created_at: any = {}
        if (startDate) {
          const d = new Date(startDate)
          if (isNaN(d.getTime())) return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid startDate'))
          created_at.gte = d
        }
        if (endDate) {
          const d = new Date(endDate)
          if (isNaN(d.getTime())) return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid endDate'))
          created_at.lte = d
        }
        where.created_at = created_at
      }

      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          select: { id: true, actor_id: true, action: true, target_id: true, meta: true, created_at: true },
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ])

      const res = toSuccessResponse({ logs: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
      recordApiAvailability('/api/admin/audit', 'GET', 200)
      recordApiResponseTime('/api/admin/audit', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      logger.error('Admin audit GET failed', error instanceof Error ? error : new Error(String(error)))
      recordApiAvailability('/api/admin/audit', 'GET', 500)
      recordApiResponseTime('/api/admin/audit', 'GET', Date.now() - start, 500)
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})
