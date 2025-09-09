import type { NextRequest} from 'next/server';

import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { sloMonitor } from '@elevate/logging'
import { getSafeServerLogger } from '@elevate/logging/safe-server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const baseLogger = await getSafeServerLogger('slo')
  const logger = baseLogger.forRequestWithHeaders
    ? baseLogger.forRequestWithHeaders(request)
    : baseLogger

  try {
    // Gate internal endpoint via env
    if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
      return new Response(null, { status: 404 })
    }
    // Check for authorization - only internal monitoring should access this
    const authHeader = request.headers.get('authorization')
    const token = process.env.INTERNAL_METRICS_TOKEN
    // In production, fail closed if token missing
    if (!token && process.env.NODE_ENV === 'production') {
      return createErrorResponse(new Error('SLO token not configured'), 403)
    }
    const expectedAuth = `Bearer ${token || 'dev-token'}`

    if (authHeader !== expectedAuth) {
      logger.warn('Unauthorized SLO access attempt', {
        operation: 'slo_access',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })

      return createErrorResponse(new Error('Unauthorized'), 401)
    }

    const sloName = request.nextUrl.searchParams.get('slo')

    if (sloName) {
      // Get specific SLO status
      const status = sloMonitor.getSLOStatus(sloName)

      if (!status) {
        return createErrorResponse(new Error('SLO not found'), 404)
      }

      logger.info('SLO status accessed', {
        operation: 'slo_status_access',
        slo_name: sloName,
      })

      const res = createSuccessResponse(status)
      res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res
    }

    // Get all SLO summary
    const sloSummary = sloMonitor.getSLOSummary()

    logger.info('SLO summary accessed', {
      operation: 'slo_summary_access',
      total_slos: sloSummary.total_slos,
      breaching_slos: sloSummary.breaching_slos,
    })

    const res = createSuccessResponse(sloSummary)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res
  } catch (error) {
    logger.error(
      'Failed to retrieve SLO data',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'slo_access_error',
      },
    )

    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
