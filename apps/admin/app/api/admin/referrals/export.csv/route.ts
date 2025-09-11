import { NextResponse, type NextRequest } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const QuerySchema = z.object({
  referrerId: z.string().optional(),
  refereeId: z.string().optional(),
  email: z.string().email().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

function cell(v: unknown) {
  let s = String(v ?? '')
  const first = s.charAt(0)
  if (first && ['=', '+', '-', '@'].includes(first)) s = `'${s}`
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) return new NextResponse('Invalid query', { status: 400 })
    const { referrerId, refereeId, email, month } = parsed.data

    let monthStart: Date | undefined
    let monthEnd: Date | undefined
    if (month) {
      const [ys, ms] = month.split('-') as [string, string]
      const y = Number.parseInt(ys, 10)
      const m = Number.parseInt(ms, 10)
      monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
      monthEnd = new Date(Date.UTC(y, m, 1, 0, 0, 0))
    }

    const where: any = {}
    if (referrerId) where.referrer_user_id = referrerId
    if (refereeId) where.referee_user_id = refereeId
    if (monthStart && monthEnd) where.created_at = { gte: monthStart, lt: monthEnd }
    if (email) {
      const u = await prisma.user.findMany({ where: { email: email.toLowerCase() }, select: { id: true } })
      const ids = u.map((x) => x.id)
      where.OR = [{ referrer_user_id: { in: ids } }, { referee_user_id: { in: ids } }]
    }

    const headers = ['when','event','source','referrer_name','referrer_email','referee_name','referee_email','referee_type','external_event_id']
    const out: string[] = [headers.join(',')]

    const pageSize = 1000
    let offset = 0
    while (true) {
      const rows = await prisma.referralEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageSize,
        include: {
          referrer: { select: { name: true, email: true } },
          referee: { select: { name: true, email: true, user_type: true } },
        },
      })
      if (!rows || rows.length === 0) break
      for (const r of rows) {
        out.push([
          r.created_at.toISOString(),
          r.event_type,
          r.source ?? '',
          r.referrer?.name ?? '',
          r.referrer?.email ?? '',
          r.referee?.name ?? '',
          r.referee?.email ?? '',
          r.referee?.user_type ?? '',
          r.external_event_id ?? '',
        ].map(cell).join(','))
      }
      offset += pageSize
    }

    return new NextResponse(out.join('\n'), {
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="referrals_${month || 'all'}.csv"`,
        'Cache-Control': 'no-store',
      }),
    })
  })
}
