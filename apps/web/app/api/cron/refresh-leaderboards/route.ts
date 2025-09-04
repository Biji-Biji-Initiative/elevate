import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@elevate/db/client';
import { Prisma } from '@prisma/client';
import { getServerLogger } from '@elevate/logging/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for refresh operations

type RefreshStats = {
  view_name: string
  refresh_duration_ms: number
  row_count: number
  success: boolean
  error?: string
}

async function refreshViewWithStats(viewName: string): Promise<RefreshStats> {
  const startTime = Date.now()
  
  try {
    // Refresh the materialized view concurrently for minimal locking
    // Safe: viewName comes from a curated list below
    await prisma.$executeRaw(
      Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${Prisma.raw(viewName)};`
    )
    
    // Get row count for the refreshed view
    const countResult = await prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint as count FROM ${Prisma.raw(viewName)};`
    )
    const rowCount = Number(countResult?.[0]?.count ?? 0)
    
    return {
      view_name: viewName,
      refresh_duration_ms: Date.now() - startTime,
      row_count: rowCount,
      success: true
    }
  } catch (error) {
    return {
      view_name: viewName,
      refresh_duration_ms: Date.now() - startTime,
      row_count: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET(request: NextRequest) {
  const jobStartTime = Date.now()
  const timestamp = new Date().toISOString()
  
  // Create logger with request context
  const logger = getServerLogger().forRequestWithHeaders(request)

  try {
    // Verify this is coming from Vercel Cron or authorized request
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized',
        timestamp
      }, { status: 401 });
    }

    logger.info('Starting materialized view refresh job', {
      operation: 'refresh_leaderboards_cron',
      timestamp,
    })

    // Refresh each materialized view with detailed statistics
    const materialized_views = [
      'leaderboard_totals',
      'leaderboard_30d', 
      'activity_metrics',
      'platform_stats_overview',
      'cohort_performance_stats',
      'monthly_growth_stats'
    ]

    // Run refreshes in parallel for better performance
    const refreshPromises = materialized_views.map(viewName => refreshViewWithStats(viewName))
    const refreshResults = await Promise.all(refreshPromises)

    // Check if any refreshes failed
    const failedRefreshes = refreshResults.filter(r => !r.success)
    const successfulRefreshes = refreshResults.filter(r => r.success)

    // Log detailed refresh statistics
    refreshResults.forEach(result => {
      const status = result.success ? 'SUCCESS' : 'FAILED'
      if (result.success) {
        logger.info(`Materialized view refresh completed: ${result.view_name}`, {
          operation: 'refresh_materialized_view',
          view_name: result.view_name,
          duration_ms: result.refresh_duration_ms,
          row_count: result.row_count,
          status: 'success',
        })
      } else {
        logger.error(`Materialized view refresh failed: ${result.view_name}`, result.error ? new Error(result.error) : undefined, {
          operation: 'refresh_materialized_view',
          view_name: result.view_name,
          duration_ms: result.refresh_duration_ms,
          status: 'failed',
          error: result.error,
        })
      }
    })

    // Perform maintenance tasks only if refreshes were successful
    let cleanupResult = { count: 0 }
    let indexMaintenanceResult = { success: false, duration_ms: 0 }

    if (failedRefreshes.length === 0) {
      // Clean up old audit logs (older than 1 year)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      try {
        cleanupResult = await prisma.auditLog.deleteMany({
          where: { created_at: { lt: oneYearAgo } }
        })
        logger.info('Audit log cleanup completed', {
          operation: 'cleanup_audit_logs',
          records_deleted: cleanupResult.count,
          cutoff_date: oneYearAgo.toISOString(),
        })
      } catch (error) {
        logger.error('Audit log cleanup failed', error instanceof Error ? error : new Error(String(error)), {
          operation: 'cleanup_audit_logs',
          cutoff_date: oneYearAgo.toISOString(),
        })
      }

      // Update table statistics for better query planning
      const indexStartTime = Date.now()
      try {
        await prisma.$executeRaw(
          Prisma.sql`ANALYZE leaderboard_totals, leaderboard_30d, activity_metrics;`
        )
        indexMaintenanceResult = {
          success: true,
          duration_ms: Date.now() - indexStartTime
        }
        logger.info('Database statistics updated', {
          operation: 'analyze_tables',
          duration_ms: indexMaintenanceResult.duration_ms,
        })
      } catch (error) {
        logger.error('Database statistics update failed', error instanceof Error ? error : new Error(String(error)), {
          operation: 'analyze_tables',
          duration_ms: Date.now() - indexStartTime,
        })
      }
    }

    const totalDuration = Date.now() - jobStartTime
    const hasErrors = failedRefreshes.length > 0

    const responseData = {
      success: !hasErrors,
      timestamp,
      total_duration_ms: totalDuration,
      materialized_views: {
        total_count: materialized_views.length,
        successful_count: successfulRefreshes.length,
        failed_count: failedRefreshes.length,
        details: refreshResults
      },
      maintenance: {
        audit_logs_cleaned: cleanupResult.count,
        statistics_updated: indexMaintenanceResult.success,
        statistics_duration_ms: indexMaintenanceResult.duration_ms
      },
      performance: {
        total_rows_refreshed: successfulRefreshes.reduce((sum, r) => sum + r.row_count, 0),
        average_refresh_time_ms: successfulRefreshes.length > 0 
          ? Math.round(successfulRefreshes.reduce((sum, r) => sum + r.refresh_duration_ms, 0) / successfulRefreshes.length)
          : 0
      }
    }

    const completionStatus = hasErrors ? 'WITH ERRORS' : 'SUCCESS'
    logger.info(`Refresh job completed: ${completionStatus}`, {
      operation: 'refresh_leaderboards_cron_complete',
      total_duration_ms: totalDuration,
      views_successful: successfulRefreshes.length,
      views_failed: failedRefreshes.length,
      total_views: materialized_views.length,
      audit_logs_cleaned: cleanupResult.count,
      statistics_updated: indexMaintenanceResult.success,
      has_errors: hasErrors,
    })

    return NextResponse.json(responseData, {
      status: hasErrors ? 207 : 200, // 207 Multi-Status for partial failures
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const totalDuration = Date.now() - jobStartTime
    
    logger.error('Refresh job failed', error instanceof Error ? error : new Error(errorMessage), {
      operation: 'refresh_leaderboards_cron_error',
      total_duration_ms: totalDuration,
      error_message: errorMessage,
    })
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp,
      total_duration_ms: totalDuration
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}
