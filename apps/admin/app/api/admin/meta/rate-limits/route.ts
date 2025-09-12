import type { NextRequest } from 'next/server'


import { requireRole } from '@elevate/auth/server-helpers'
import { toSuccessResponse } from '@/lib/server/http'
import { withRateLimit, adminRateLimiter, getRateLimitStats, resetRateLimitStats } from '@elevate/security'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const url = new URL(request.url)
    const reset = url.searchParams.get('reset') === 'true'
    const stats = getRateLimitStats()
    if (reset) resetRateLimitStats()
    return toSuccessResponse({ stats, reset })
  })
}
