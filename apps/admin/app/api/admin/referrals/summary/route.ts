import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const QuerySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext): Promise<NextResponse> => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const start = Date.now()
    const baseLogger = await getSafeServerLogger('admin-referrals-summary')
    const logger = createRequestLogger(baseLogger, request)
    try {
      const { searchParams } = new URL(request.url)
      const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
      if (!parsed.success) return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid query'))
      const { month } = parsed.data
      const [ys, ms] = month.split('-') as [string, string]
      const y = Number.parseInt(ys, 10)
      const m = Number.parseInt(ms, 10)
      const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
      const monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))

      // Totals
      const [total, educators, students] = await Promise.all([
        prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd } } }),
        prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd }, referee: { user_type: 'EDUCATOR' } } }),
        prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd }, referee: { user_type: 'STUDENT' } } }),
      ])

      // Unique referrers (distinct)
      const distinctRows = await prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(DISTINCT referrer_user_id)::bigint AS cnt FROM referral_events WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}`
      const uniqueReferrers = Number(distinctRows?.[0]?.cnt || 0)

      // Points awarded via referral this month
      const pointsAgg = await prisma.pointsLedger.aggregate({
        _sum: { delta_points: true },
        where: { external_source: 'referral', event_time: { gte: monthStart, lt: monthEnd } },
      })
      const pointsAwarded = pointsAgg._sum.delta_points || 0

      // Top referrers by referral points
      const top = await prisma.pointsLedger.groupBy({
        by: ['user_id'],
        where: { external_source: 'referral', event_time: { gte: monthStart, lt: monthEnd } },
        _sum: { delta_points: true },
        orderBy: { _sum: { delta_points: 'desc' } },
        take: 5,
      })
      const topIds = top.map((t) => t.user_id)
      const users = topIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true, email: true, handle: true, user_type: true } }) : []
      const byId = new Map(users.map((u) => [u.id, u]))
      const topReferrers = top.map((t) => ({
        userId: t.user_id,
        points: t._sum.delta_points || 0,
        user: byId.get(t.user_id) || { id: t.user_id, name: '', email: '', handle: '', user_type: 'EDUCATOR' },
      }))

      const res = toSuccessResponse({
        month,
        total,
        byType: { educators, students },
        uniqueReferrers,
        pointsAwarded,
        topReferrers,
      })
      recordApiAvailability('/api/admin/referrals/summary', 'GET', 200)
      recordApiResponseTime('/api/admin/referrals/summary', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      logger.error('Referrals summary failed', error instanceof Error ? error : new Error(String(error)))
      recordApiAvailability('/api/admin/referrals/summary', 'GET', 500)
      recordApiResponseTime('/api/admin/referrals/summary', 'GET', Date.now() - start, 500)
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})
