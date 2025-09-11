"use server"
import 'server-only'

import { z } from 'zod'


import { toReferralRow, type ReferralEventRow } from '@/lib/server/mappers'
import { requireRole } from '@elevate/auth/server-helpers'
import type { Prisma } from '@elevate/db'
import { prisma } from '@elevate/db'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { handleApiError } from '@/lib/error-utils'
import { recordSLO } from '@/lib/server/obs'
import { AdminError } from '@/lib/server/admin-error'

export const ReferralsQuerySchema = z.object({
  referrerId: z.string().optional(),
  refereeId: z.string().optional(),
  email: z.string().email().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

export type ReferralsQuery = z.infer<typeof ReferralsQuerySchema>

export async function listReferralsService(params: ReferralsQuery) {
  await requireRole('admin')
  const start = Date.now()
  try {
  const parsed = ReferralsQuerySchema.parse(params)
  const { referrerId, refereeId, email, month, limit, offset } = parsed

  let monthStart: Date | undefined
  let monthEnd: Date | undefined
  if (typeof month === 'string' && month.length === 7) {
    const [ys, ms] = month.split('-') as [string, string]
    const y = Number.parseInt(ys, 10)
    const m = Number.parseInt(ms, 10)
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
      monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))
    }
  }

  const where: Prisma.ReferralEventWhereInput = {}
  if (referrerId) where.referrer_user_id = referrerId
  if (refereeId) where.referee_user_id = refereeId
  if (monthStart && monthEnd) where.created_at = { gte: monthStart, lt: monthEnd }

  if (email) {
    const u = await prisma.user.findMany({ where: { email: email.toLowerCase() }, select: { id: true } })
    const ids = u.map((x) => x.id)
    if (ids.length === 0) {
      return { referrals: [], pagination: { total: 0, limit, offset, pages: 0 } }
    }
    where.OR = [{ referrer_user_id: { in: ids } }, { referee_user_id: { in: ids } }]
  }

  const [rows, total] = await Promise.all([
    prisma.referralEvent.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referee: { select: { id: true, name: true, email: true, user_type: true } },
      },
    }),
    prisma.referralEvent.count({ where }),
  ])

  const referrals = (rows as ReferralEventRow[]).map((r) => toReferralRow(r))

  const logger = await getSafeServerLogger('admin-referrals')
  logger.info('Listed referrals', { limit, offset, filters: { referrerId, refereeId, email, month } })
  recordSLO('/admin/service/referrals/list', start, 200)

  return {
    referrals,
    pagination: { total, limit, offset, pages: Math.ceil(total / limit) },
  }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-referrals')
    logger.error('List referrals failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/referrals/list', start, 500)
    throw new Error(handleApiError(err, 'List referrals failed'))
  }
}

export async function referralsMonthlySummaryService(month: string): Promise<{
  month: string
  total: number
  byType: { educators: number; students: number }
  uniqueReferrers: number
  pointsAwarded: number
  topReferrers: Array<{ userId: string; points: number; user: { id: string; name: string; email: string; handle: string; user_type: 'EDUCATOR' | 'STUDENT' } }>
}> {
  await requireRole('admin')
  const start = Date.now()
  try {
  const parts = month.split('-')
  if (parts.length !== 2) throw new AdminError('VALIDATION_ERROR', 'Invalid month format')
  const y = Number.parseInt(String(parts[0] ?? ''), 10)
  const m = Number.parseInt(String(parts[1] ?? ''), 10)
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))

  const [total, educators, students] = await Promise.all([
    prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd } } }),
    prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd }, referee: { user_type: 'EDUCATOR' } } }),
    prisma.referralEvent.count({ where: { created_at: { gte: monthStart, lt: monthEnd }, referee: { user_type: 'STUDENT' } } }),
  ])

  const distinctRows = await prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(DISTINCT referrer_user_id)::bigint AS cnt FROM referral_events WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}`
  const uniqueReferrers = Number(distinctRows?.[0]?.cnt || 0)

  const pointsAgg = await prisma.pointsLedger.aggregate({
    _sum: { delta_points: true },
    where: { external_source: 'referral', event_time: { gte: monthStart, lt: monthEnd } },
  })
  const pointsAwarded = pointsAgg._sum.delta_points || 0

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

  const logger = await getSafeServerLogger('admin-referrals')
  logger.info('Monthly summary', { month, total, educators, students, uniqueReferrers, pointsAwarded })
  recordSLO('/admin/service/referrals/monthly-summary', start, 200)
  return { month, total, byType: { educators, students }, uniqueReferrers, pointsAwarded, topReferrers }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-referrals')
    logger.error('Monthly summary failed', { month, error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/referrals/monthly-summary', start, 500)
    throw new Error(handleApiError(err, 'Monthly summary failed'))
  }
}
