import type { NextRequest } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import type { Prisma } from '@elevate/db'
import { prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER, withApiErrorHandling, type ApiContext } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'

export const runtime = 'nodejs'

const QuerySchema = z.object({
  referrerId: z.string().optional(),
  refereeId: z.string().optional(),
  email: z.string().email().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // YYYY-MM
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  const baseLogger = await getSafeServerLogger('admin-referrals')
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const logger = createRequestLogger(baseLogger, request)
    const url = new URL(request.url)
    const raw = Object.fromEntries(url.searchParams)
    const parsed = QuerySchema.safeParse(raw)
    if (!parsed.success) return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid query'))
    const { referrerId, refereeId, email, month, limit, offset } = parsed.data

    let monthStart: Date | undefined
    let monthEnd: Date | undefined
    if (typeof month === 'string' && month.length === 7) {
      const parts = month.split('-') as [string, string]
      const ys = parts[0]
      const ms = parts[1]
      const y = Number.isFinite(parseInt(ys, 10)) ? parseInt(ys, 10) : NaN
      const m = Number.isFinite(parseInt(ms, 10)) ? parseInt(ms, 10) : NaN
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
        monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))
      }
    }

    // Build where clause
    const where: Prisma.ReferralEventWhereInput = {}
    if (referrerId) where.referrer_user_id = referrerId
    if (refereeId) where.referee_user_id = refereeId
    if (monthStart && monthEnd)
      where.created_at = { gte: monthStart, lt: monthEnd }

    // If email filter is provided, resolve user id(s)
    if (email) {
      const u = await prisma.user.findMany({
        where: { email: email.toLowerCase() },
        select: { id: true },
      })
      const ids = u.map((x) => x.id)
      if (ids.length === 0)
        {
          const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
          const res = toSuccessResponse({
            referrals: [],
            pagination: { total: 0, limit, offset, pages: 0 },
          })
          if (traceId) res.headers.set(TRACE_HEADER, traceId)
          return res
        }
      where.OR = [
        { referrer_user_id: { in: ids } },
        { referee_user_id: { in: ids } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.referralEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
        include: {
          referrer: { select: { id: true, name: true, email: true } },
          referee: {
            select: { id: true, name: true, email: true, user_type: true },
          },
        },
      }),
      prisma.referralEvent.count({ where }),
    ])

    {
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const res = toSuccessResponse({
        referrals: rows.map((r) => ({
          id: r.id,
          eventType: r.event_type,
          source: r.source,
          createdAt: r.created_at,
          externalEventId: r.external_event_id,
          referrer: r.referrer,
          referee: r.referee,
        })),
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit),
        },
      })
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      logger.info('Referrals fetched', { total })
      return res
    }
  })
})
