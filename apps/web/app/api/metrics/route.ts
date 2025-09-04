import { NextRequest, NextResponse } from 'next/server'
import { getServerLogger } from '@elevate/logging/server'
import { metrics } from '@elevate/logging'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const logger = getServerLogger().forRequestWithHeaders(request)
  
  try {
    // Check for authorization - only internal monitoring should access this
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.INTERNAL_METRICS_TOKEN || 'dev-token'}`
    
    if (authHeader !== expectedAuth) {
      logger.warn('Unauthorized metrics access attempt', {
        operation: 'metrics_access',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
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
    
    return NextResponse.json(metricsSummary, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
    
  } catch (error) {
    logger.error('Failed to retrieve metrics', error instanceof Error ? error : new Error(String(error)), {
      operation: 'metrics_access_error',
    })
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}