import type { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { isKajabiHealthy } from '@elevate/integrations'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const logger = await getSafeServerLogger('admin-kajabi-health')
    try {
      const start = Date.now()
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const hasKey = !!process.env.KAJABI_API_KEY
      const hasSecret = !!process.env.KAJABI_CLIENT_SECRET
      const healthy = hasKey && hasSecret ? await isKajabiHealthy() : false
      logger.info('Kajabi health checked', { healthy, hasKey, hasSecret })
      const res = toSuccessResponse({ healthy, hasKey, hasSecret })
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      recordApiAvailability('/api/admin/kajabi/health', 'GET', 200)
      recordApiResponseTime('/api/admin/kajabi/health', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      recordApiAvailability('/api/admin/kajabi/health', 'GET', 500)
      recordApiResponseTime('/api/admin/kajabi/health', 'GET', 0, 500)
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
