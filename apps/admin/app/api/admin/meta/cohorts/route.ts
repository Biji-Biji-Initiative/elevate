import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const rows = await prisma.user.findMany({
      select: { cohort: true },
      where: { NOT: { cohort: null } },
      distinct: ['cohort'] as Prisma.UserScalarFieldEnum[],
      orderBy: { cohort: 'asc' as const },
    })
    const cohorts = rows.map((r) => r.cohort).filter((c): c is string => !!c)
    return toSuccessResponse({ cohorts })
  })
})
