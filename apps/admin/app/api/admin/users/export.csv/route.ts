import { NextResponse, type NextRequest } from 'next/server'


import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { AdminUsersQuerySchema } from '@elevate/types'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import type { AdminUsersQuery } from '@elevate/types'

export const runtime = 'nodejs'

function toCsvValue(v: unknown): string {
  const s = String(v ?? '')
  // Mitigate CSV formula injection by prefixing risky leading characters
  if (s.length > 0 && ['=', '+', '-', '@'].includes(s.charAt(0))) {
    const safe = `'${s}`
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`
    }
    return safe
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const parsed = AdminUsersQuerySchema.safeParse(params)
    if (!parsed.success) {
      return new NextResponse('Invalid query', { status: 400 })
    }
    const query = parsed.data as AdminUsersQuery & { kajabi?: 'ALL' | 'LINKED' | 'UNLINKED' }
    const sp = url.searchParams
    const search = query.search ?? ''
    const role = query.role ?? 'ALL'
    const userType = (sp.get('userType') as 'ALL' | 'EDUCATOR' | 'STUDENT' | null) ?? 'ALL'
    const cohort = query.cohort ?? 'ALL'
    const sortBy = query.sortBy ?? 'created_at'
    const sortOrder = query.sortOrder ?? 'desc'

    // Build WHERE clause
    const where: Prisma.UserWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { school: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (role && role !== 'ALL') where.role = role
    if (userType && userType !== 'ALL') where.user_type = userType
    if (cohort && cohort !== 'ALL') where.cohort = cohort

    const headers = ['id','name','handle','email','role','user_type','user_type_confirmed','kajabi_contact_id','school','cohort','total_points','created_at']
    const lines: string[] = []
    lines.push(headers.join(','))

    const pageSize = 1000
    let offset = 0
    // Iterate until no rows returned
    for (;;) {
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          handle: true,
          email: true,
          role: true,
          user_type: true,
          user_type_confirmed: true,
          kajabi_contact_id: true,
          school: true,
          cohort: true,
          created_at: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: pageSize,
      })
      if (!users || users.length === 0) break
      const ids = users.map((u) => u.id)
      const totals = await prisma.pointsLedger.groupBy({
        by: ['user_id'],
        where: { user_id: { in: ids } },
        _sum: { delta_points: true },
      })
      const totalsMap = new Map(totals.map((t) => [t.user_id, t._sum.delta_points || 0]))
      for (const u of users) {
        const row = [
          u.id,
          u.name ?? '',
          u.handle ?? '',
          u.email ?? '',
          u.role ?? '',
          u.user_type ?? '',
          u.user_type_confirmed ? 'yes' : 'no',
          u.kajabi_contact_id ?? '',
          u.school ?? '',
          u.cohort ?? '',
          String(totalsMap.get(u.id) || 0),
          u.created_at.toISOString(),
        ]
        lines.push(row.map(toCsvValue).join(','))
      }
      offset += pageSize
    }

    const csv = lines.join('\n')
    const res = new NextResponse(csv, {
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users_${new Date().toISOString().slice(0,10)}.csv"`,
        'Cache-Control': 'no-store',
      }),
    })
    return res
  })
})
