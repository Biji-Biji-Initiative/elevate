import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { metrics } from '@elevate/logging'
import { getServerLogger } from '@elevate/logging/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const logger = getServerLogger().forRequestWithHeaders(request)

  try {
    if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
      return new Response(null, { status: 404 })
    }
    // Check for authorization - only internal monitoring should access this
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${
      process.env.INTERNAL_METRICS_TOKEN || 'dev-token'
    }`

    if (authHeader !== expectedAuth) {
      logger.warn('Unauthorized metrics access attempt', {
        operation: 'metrics_access',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })

      return createErrorResponse(new Error('Unauthorized'), 401)
    }

    const format = request.nextUrl.searchParams.get('format') || 'json'

    if (format === 'prometheus') {
      // Return Prometheus metrics format
      const prometheusMetrics = metrics.getPrometheusMetrics()

      logger.info('Metrics accessed in Prometheus format', {
        operation: 'metrics_prometheus_access',
      })

      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    // Default JSON format
    const metricsSummary = metrics.getMetricsSummary()

    logger.info('Metrics accessed in JSON format', {
      operation: 'metrics_json_access',
    })

    res = createSuccessResponse(metricsSummary)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res
  } catch (error) {
    logger.error(
      'Failed to retrieve metrics',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'metrics_access_error',
      },
    )

    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
