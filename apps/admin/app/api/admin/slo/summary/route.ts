import type { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
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
      const slo = request.nextUrl.searchParams.get('slo')
      if (slo) {
        const status = sloMonitor.getSLOStatus(slo)
        if (!status) {
          recordApiAvailability('/api/admin/slo/summary', 'GET', 404)
          recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 404)
          return createErrorResponse(new Error('SLO not found'), 404)
        }
        const res = createSuccessResponse(status)
        recordApiAvailability('/api/admin/slo/summary', 'GET', 200)
        recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 200)
        return res
      }
      const summary = sloMonitor.getSLOSummary()
      logger.info('SLO summary served', { total: summary.total_slos, breaching: summary.breaching_slos })
      const res = createSuccessResponse(summary)
      recordApiAvailability('/api/admin/slo/summary', 'GET', 200)
      recordApiResponseTime('/api/admin/slo/summary', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/slo/summary', 'GET', 500)
      recordApiResponseTime('/api/admin/slo/summary', 'GET', 0, 500)
      return createErrorResponse(new Error('Failed to fetch SLO data'), 500)
    }
  })
}
