import type { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime, sloMonitor } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const logger = await getSafeServerLogger('admin-slo-summary')
    try {
      const start = Date.now()
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const slo = request.nextUrl.searchParams.get('slo')
      if (slo) {
        const status = sloMonitor.getSLOStatus(slo)
        if (!status) {
          recordApiAvailability('/api/admin/slo/summary', 'GET', 404)
          recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 404)
          const errRes = toErrorResponse(new AdminError('NOT_FOUND', 'SLO not found'))
          if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
          return errRes
        }
        const res = toSuccessResponse(status)
        if (traceId) res.headers.set(TRACE_HEADER, traceId)
        recordApiAvailability('/api/admin/slo/summary', 'GET', 200)
        recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 200)
        return res
      }
      const summary = sloMonitor.getSLOSummary()
      logger.info('SLO summary served', { total: summary.total_slos, breaching: summary.breaching_slos })
      const res = toSuccessResponse(summary)
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      recordApiAvailability('/api/admin/slo/summary', 'GET', 200)
      recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/slo/summary', 'GET', 500)
      recordApiResponseTime('/api/admin/slo/summary', 'GET', 0, 500)
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
