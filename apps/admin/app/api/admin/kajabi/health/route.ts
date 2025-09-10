import type { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
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
      const hasKey = !!process.env.KAJABI_API_KEY
      const hasSecret = !!process.env.KAJABI_CLIENT_SECRET
      const healthy = hasKey && hasSecret ? await isKajabiHealthy() : false
      logger.info('Kajabi health checked', { healthy, hasKey, hasSecret })
      const res = createSuccessResponse({ healthy, hasKey, hasSecret })
      recordApiAvailability('/api/admin/kajabi/health', 'GET', 200)
      recordApiResponseTime('/api/admin/kajabi/health', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/kajabi/health', 'GET', 500)
      recordApiResponseTime('/api/admin/kajabi/health', 'GET', 0, 500)
      return createErrorResponse(new Error('Failed to check Kajabi health'), 500)
    }
  })
}
