import { NextResponse, type NextRequest } from 'next/server'
import { TRACE_HEADER } from '@elevate/http'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const QuerySchema = z.object({
  targetId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
    const { targetId, actorId, action, startDate, endDate } = parsed.data

    const where: any = {}
    if (targetId) where.target_id = targetId
    if (actorId) where.actor_id = actorId
    if (action) where.action = action
    if (startDate || endDate) {
      const created_at: any = {}
      if (startDate) {
        const d = new Date(startDate)
        if (isNaN(d.getTime())) return new NextResponse('Invalid startDate', { status: 400 })
        created_at.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (isNaN(d.getTime())) return new NextResponse('Invalid endDate', { status: 400 })
        created_at.lte = d
      }
      where.created_at = created_at
    }

    const headers = ['created_at','action','actor_id','target_id','meta']
    const out: string[] = [headers.join(',')]
    const pageSize = 1000
    let offset = 0
    while (true) {
      const rows = await prisma.auditLog.findMany({
        where,
        select: { created_at: true, action: true, actor_id: true, target_id: true, meta: true },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: pageSize,
      })
      if (!rows || rows.length === 0) break
      for (const r of rows) {
        const meta = r.meta ? JSON.stringify(r.meta) : ''
        out.push([
          r.created_at.toISOString(),
          r.action,
          r.actor_id,
          r.target_id || '',
          meta,
        ].map(cell).join(','))
      }
      offset += pageSize
    }

    const res = new NextResponse(out.join('\n'), {
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="audit_export.csv"',
        'Cache-Control': 'no-store',
      }),
    })
    const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
    if (traceId) res.headers.set(TRACE_HEADER, traceId)
    return res
  })
}
