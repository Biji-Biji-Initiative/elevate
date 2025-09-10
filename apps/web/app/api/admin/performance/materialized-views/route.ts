import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { requireRole } from '@elevate/auth'
import { Prisma } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
// Local error wrapper to avoid resolver issues
function wrapError(err: unknown, message?: string): Error {
  if (err instanceof Error)
    return new Error(message ? `${message}: ${err.message}` : err.message)
  return new Error(message ?? String(err))
}

export const runtime = 'nodejs'

type MaterializedViewStats = {
  view_name: string
  size_bytes: number
  size_pretty: string
  row_count: number
  last_refresh: Date | null
  refresh_in_progress: boolean
  index_count: number
  index_usage_stats: {
    total_scans: number
    total_tuples_read: number
    avg_scans_per_index: number
  }
  query_performance: {
    seq_scans: number
    seq_tuples_read: number
    index_scans: number
    index_tuples_fetched: number
    cache_hit_ratio: number
  }
}

type PerformanceBenchmark = {
  operation: string
  duration_ms: number
  rows_affected: number
  timestamp: Date
}

async function getViewStats(viewName: string): Promise<MaterializedViewStats> {
  // Get basic view information
  const viewInfo = await prisma.$queryRaw<
    Array<{
      size_bytes: number
      size_pretty: string
      row_count: number
    }>
  >`
    SELECT 
      pg_total_relation_size('${Prisma.raw(viewName)}') as size_bytes,
      pg_size_pretty(pg_total_relation_size('${Prisma.raw(
        viewName,
      )}')) as size_pretty,
      (SELECT COUNT(*) FROM ${Prisma.raw(viewName)}) as row_count
  `

  // Get refresh status (check if any refresh operations are running)
  const refreshStatus = await prisma.$queryRaw<
    Array<{
      refresh_in_progress: boolean
      last_refresh: Date | null
    }>
  >`
    SELECT 
      (SELECT COUNT(*) > 0 FROM pg_stat_activity 
       WHERE query LIKE '%REFRESH MATERIALIZED VIEW%${viewName}%' 
       AND state = 'active') as refresh_in_progress,
      (SELECT stats_reset FROM pg_stat_user_tables 
       WHERE relname = '${Prisma.raw(viewName)}') as last_refresh
  `

  // Get index information
  const indexStats = await prisma.$queryRaw<
    Array<{
      index_count: number
      total_scans: number
      total_tuples_read: number
    }>
  >`
    SELECT 
      COUNT(*) as index_count,
      COALESCE(SUM(idx_scan), 0) as total_scans,
      COALESCE(SUM(idx_tup_read), 0) as total_tuples_read
    FROM pg_stat_user_indexes 
    WHERE tablename = '${Prisma.raw(viewName)}'
  `

  // Get query performance stats
  const queryStats = await prisma.$queryRaw<
    Array<{
      seq_scans: number
      seq_tuples_read: number
      index_scans: number
      index_tuples_fetched: number
      heap_blks_read: number
      heap_blks_hit: number
    }>
  >`
    SELECT 
      COALESCE(seq_scan, 0) as seq_scans,
      COALESCE(seq_tup_read, 0) as seq_tuples_read,
      COALESCE(idx_scan, 0) as index_scans,
      COALESCE(idx_tup_fetch, 0) as index_tuples_fetched,
      COALESCE(heap_blks_read, 0) as heap_blks_read,
      COALESCE(heap_blks_hit, 0) as heap_blks_hit
    FROM pg_stat_user_tables 
    WHERE relname = '${Prisma.raw(viewName)}'
  `

  const info = viewInfo[0]
  const refresh = refreshStatus[0]
  const indexes = indexStats[0]
  const queries = queryStats[0]

  if (!info || !refresh || !indexes || !queries) {
    throw new Error(`Failed to retrieve complete stats for view: ${viewName}`)
  }

  // Calculate cache hit ratio
  const totalBlocks =
    Number(queries.heap_blks_read) + Number(queries.heap_blks_hit)
  const cacheHitRatio =
    totalBlocks > 0 ? (Number(queries.heap_blks_hit) / totalBlocks) * 100 : 100

  return {
    view_name: viewName,
    size_bytes: Number(info.size_bytes),
    size_pretty: info.size_pretty,
    row_count: Number(info.row_count),
    last_refresh: refresh.last_refresh,
    refresh_in_progress: refresh.refresh_in_progress,
    index_count: Number(indexes.index_count),
    index_usage_stats: {
      total_scans: Number(indexes.total_scans),
      total_tuples_read: Number(indexes.total_tuples_read),
      avg_scans_per_index:
        Number(indexes.index_count) > 0
          ? Math.round(
              Number(indexes.total_scans) / Number(indexes.index_count),
            )
          : 0,
    },
    query_performance: {
      seq_scans: Number(queries.seq_scans),
      seq_tuples_read: Number(queries.seq_tuples_read),
      index_scans: Number(queries.index_scans),
      index_tuples_fetched: Number(queries.index_tuples_fetched),
      cache_hit_ratio: Math.round(cacheHitRatio * 100) / 100,
    },
  }
}

async function runPerformanceBenchmarks(): Promise<PerformanceBenchmark[]> {
  const benchmarks: PerformanceBenchmark[] = []

  // Benchmark 1: Leaderboard query (all-time)
  const leaderboardStart = Date.now()
  await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points, public_submissions 
    FROM leaderboard_totals 
    ORDER BY total_points DESC 
    LIMIT 50
  `
  benchmarks.push({
    operation: 'leaderboard_totals_top_50',
    duration_ms: Date.now() - leaderboardStart,
    rows_affected: 50,
    timestamp: new Date(),
  })

  // Benchmark 2: Leaderboard query (30-day)
  const leaderboard30dStart = Date.now()
  await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points, public_submissions 
    FROM leaderboard_30d 
    ORDER BY total_points DESC 
    LIMIT 50
  `
  benchmarks.push({
    operation: 'leaderboard_30d_top_50',
    duration_ms: Date.now() - leaderboard30dStart,
    rows_affected: 50,
    timestamp: new Date(),
  })

  // Benchmark 3: Search query
  const searchStart = Date.now()
  await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points 
    FROM leaderboard_totals 
    WHERE name ILIKE '%edu%' OR handle ILIKE '%edu%' 
    ORDER BY total_points DESC 
    LIMIT 20
  `
  benchmarks.push({
    operation: 'leaderboard_search_query',
    duration_ms: Date.now() - searchStart,
    rows_affected: 20,
    timestamp: new Date(),
  })

  // Benchmark 4: Activity metrics query
  const metricsStart = Date.now()
  await prisma.$queryRaw`
    SELECT code, name, total_submissions, approved_submissions, avg_points_per_submission 
    FROM activity_metrics 
    ORDER BY total_submissions DESC
  `
  benchmarks.push({
    operation: 'activity_metrics_full_scan',
    duration_ms: Date.now() - metricsStart,
    rows_affected: 5, // Assuming 5 activities (LEARN, EXPLORE, etc.)
    timestamp: new Date(),
  })

  // Benchmark 5: Cohort filtering
  const cohortStart = Date.now()
  await prisma.$queryRaw`
    SELECT cohort, COUNT(*) as user_count, AVG(total_points) as avg_points
    FROM leaderboard_totals 
    WHERE cohort IS NOT NULL
    GROUP BY cohort 
    ORDER BY avg_points DESC
  `
  benchmarks.push({
    operation: 'cohort_aggregation',
    duration_ms: Date.now() - cohortStart,
    rows_affected: 10, // Estimated cohort count
    timestamp: new Date(),
  })

  return benchmarks
}

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
    return new Response(null, { status: 404 })
  }
  try {
    // Verify admin role
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse(new Error('Unauthorized'), 401)
    }
    // Require at least reviewer role (admin or reviewer)
    await requireRole('reviewer')

    const { searchParams } = new URL(request.url)
    const includeBenchmarks = searchParams.get('benchmarks') === 'true'

    // Get stats for all materialized views
    const materializedViews = [
      'leaderboard_totals',
      'leaderboard_30d',
      'activity_metrics',
      'platform_stats_overview',
      'cohort_performance_stats',
      'monthly_growth_stats',
    ]
    const viewStatsPromises = materializedViews.map((viewName) =>
      getViewStats(viewName),
    )
    const viewStats = await Promise.all(viewStatsPromises)

    // Get system-wide materialized view information
    const systemStats = await prisma.$queryRaw<
      Array<{
        total_materialized_views: number
        total_size_bytes: number
        total_size_pretty: string
        oldest_refresh: Date | null
      }>
    >`
      SELECT 
        COUNT(*) as total_materialized_views,
        SUM(pg_total_relation_size(schemaname||'.'||matviewname))::bigint as total_size_bytes,
        pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||matviewname))::bigint) as total_size_pretty,
        MIN(stats_reset) as oldest_refresh
      FROM pg_stat_user_tables 
      WHERE relname IN ('leaderboard_totals', 'leaderboard_30d', 'activity_metrics', 'platform_stats_overview', 'cohort_performance_stats', 'monthly_growth_stats')
    `

    let benchmarks: PerformanceBenchmark[] = []
    if (includeBenchmarks) {
      try {
        benchmarks = await runPerformanceBenchmarks()
      } catch (error: unknown) {
        const logger = await getSafeServerLogger('admin-performance')
        logger.error(
          'Performance benchmarks failed',
          wrapError(error, 'Performance benchmarks failed'),
          {
            operation: 'admin_performance_materialized_views',
          },
        )
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      system_overview: systemStats[0] || {
        total_materialized_views: 0,
        total_size_bytes: 0,
        total_size_pretty: '0 bytes',
        oldest_refresh: null,
      },
      materialized_views: viewStats,
      performance_benchmarks: benchmarks,
      recommendations: generateRecommendations(viewStats),
    }

    const res = createSuccessResponse(response)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res
  } catch (error: unknown) {
    const wrappedError = wrapError(
      error,
      'Materialized views performance monitoring failed',
    )
    const logger = await getSafeServerLogger('admin-performance')
    logger.error(
      'Materialized views performance monitoring failed',
      wrappedError,
      {
        operation: 'admin_performance_materialized_views',
      },
    )
    return createErrorResponse(wrappedError, 500)
  }
}

function generateRecommendations(stats: MaterializedViewStats[]): string[] {
  const recommendations: string[] = []

  stats.forEach((stat) => {
    // Check for high sequential scan ratio
    const totalScans =
      stat.query_performance.seq_scans + stat.query_performance.index_scans
    if (totalScans > 0) {
      const seqScanRatio = stat.query_performance.seq_scans / totalScans
      if (seqScanRatio > 0.3) {
        recommendations.push(
          `Consider adding indexes to ${
            stat.view_name
          } - high sequential scan ratio: ${Math.round(seqScanRatio * 100)}%`,
        )
      }
    }

    // Check cache hit ratio
    if (stat.query_performance.cache_hit_ratio < 95) {
      recommendations.push(
        `Low cache hit ratio for ${stat.view_name}: ${stat.query_performance.cache_hit_ratio}% - consider increasing shared_buffers`,
      )
    }

    // Check view size growth
    if (stat.size_bytes > 100 * 1024 * 1024) {
      // 100MB
      recommendations.push(
        `Large materialized view ${stat.view_name}: ${stat.size_pretty} - monitor refresh performance`,
      )
    }

    // Check index utilization
    if (
      stat.index_count > 5 &&
      stat.index_usage_stats.avg_scans_per_index < 100
    ) {
      recommendations.push(
        `Some indexes on ${stat.view_name} may be underutilized - consider index cleanup`,
      )
    }
  })

  // General recommendations
  const totalSize = stats.reduce((sum, stat) => sum + stat.size_bytes, 0)
  if (totalSize > 500 * 1024 * 1024) {
    // 500MB
    recommendations.push(
      'Total materialized view size is significant - consider scheduled VACUUM ANALYZE',
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('All materialized views are performing well!')
  }

  return recommendations
}
