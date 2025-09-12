import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Wrap in rate limiter as a light GET endpoint
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      await requireRole('admin')

      // Fetch distinct non-null cohorts
      const rows = await prisma.user.findMany({
        select: { cohort: true },
        where: { NOT: { cohort: null } },
        distinct: ['cohort'] as Prisma.UserScalarFieldEnum[],
        orderBy: { cohort: 'asc' as const },
      })

      const cohorts = rows.map((r) => r.cohort).filter((c): c is string => !!c)

      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const res = toSuccessResponse({ cohorts })
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      return res
    } catch (error) {
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
