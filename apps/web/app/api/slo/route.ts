import { NextRequest, NextResponse } from 'next/server'
import { getServerLogger } from '@elevate/logging/server'
import { sloMonitor } from '@elevate/logging'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const logger = getServerLogger().forRequestWithHeaders(request)
  
  try {
    // Check for authorization - only internal monitoring should access this
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.INTERNAL_METRICS_TOKEN || 'dev-token'}`
    
    if (authHeader !== expectedAuth) {
      logger.warn('Unauthorized SLO access attempt', {
        operation: 'slo_access',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const sloName = request.nextUrl.searchParams.get('slo')
    
    if (sloName) {
      // Get specific SLO status
      const status = sloMonitor.getSLOStatus(sloName)
      
      if (!status) {
        return NextResponse.json(
          { error: 'SLO not found' },
          { status: 404 }
        )
      }
      
      logger.info('SLO status accessed', {
        operation: 'slo_status_access',
        slo_name: sloName,
      })
      
      return NextResponse.json(status, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }
    
    // Get all SLO summary
    const sloSummary = sloMonitor.getSLOSummary()
    
    logger.info('SLO summary accessed', {
      operation: 'slo_summary_access',
      total_slos: sloSummary.total_slos,
      breaching_slos: sloSummary.breaching_slos,
    })
    
    return NextResponse.json(sloSummary, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
    
  } catch (error) {
    logger.error('Failed to retrieve SLO data', error instanceof Error ? error : new Error(String(error)), {
      operation: 'slo_access_error',
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