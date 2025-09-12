import type { NextRequest } from 'next/server'


import { requireRole } from '@elevate/auth/server-helpers'
import { toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { withRateLimit, adminRateLimiter, getRateLimitStats, resetRateLimitStats } from '@elevate/security'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const reset = url.searchParams.get('reset') === 'true'
    const stats = getRateLimitStats()
    if (reset) resetRateLimitStats()
    const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
    const res = toSuccessResponse({ stats, reset })
    if (traceId) res.headers.set(TRACE_HEADER, traceId)
    return res
  })
}
