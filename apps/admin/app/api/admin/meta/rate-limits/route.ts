import type { NextRequest } from 'next/server'


import { requireRole } from '@elevate/auth/server-helpers'
import { toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { withRateLimit, adminRateLimiter, getRateLimitStats, resetRateLimitStats } from '@elevate/security'

export const runtime = 'nodejs';

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const reset = url.searchParams.get('reset') === 'true'
    const stats = getRateLimitStats()
    if (reset) resetRateLimitStats()
    return toSuccessResponse({ stats, reset })
  })
})
