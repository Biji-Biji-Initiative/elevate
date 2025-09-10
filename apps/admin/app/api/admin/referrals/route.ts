import type { NextRequest } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db/client'
import { badRequest, createSuccessResponse } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const QuerySchema = z.object({
  referrerId: z.string().optional(),
  refereeId: z.string().optional(),
  email: z.string().email().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(), // YYYY-MM
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional()
    .default('50' as unknown as number),
  offset: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0))
    .optional()
    .default('0' as unknown as number),
})

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const raw = Object.fromEntries(url.searchParams)
    const parsed = QuerySchema.safeParse(raw)
    if (!parsed.success) return badRequest('Invalid query')
    const { referrerId, refereeId, email, month } = parsed.data
    const limit = Number(parsed.data.limit)
    const offset = Number(parsed.data.offset)

    let monthStart: Date | undefined
    let monthEnd: Date | undefined
    if (month) {
      const [y, m] = month.split('-').map((n) => parseInt(n, 10))
      monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
      monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))
    }

    // Build where clause
    const where: Parameters<typeof prisma.referralEvent.findMany>[0]['where'] = {}
    if (referrerId) where.referrer_user_id = referrerId
    if (refereeId) where.referee_user_id = refereeId
    if (monthStart && monthEnd) where.created_at = { gte: monthStart, lt: monthEnd }

    // If email filter is provided, resolve user id(s)
    if (email) {
      const u = await prisma.user.findMany({ where: { email: email.toLowerCase() }, select: { id: true } })
      const ids = u.map((x) => x.id)
      if (ids.length === 0) return createSuccessResponse({ referrals: [], pagination: { total: 0, limit, offset, pages: 0 } })
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

    return createSuccessResponse({
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
  })
}
