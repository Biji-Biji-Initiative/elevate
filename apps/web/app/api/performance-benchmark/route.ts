import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { requireRole } from '@elevate/auth'
import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { trackApiRequest } from '@elevate/logging'
import { getSafeServerLogger } from '@elevate/logging/safe-server'

import { normalizeError } from '../../lib/error-utils'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for comprehensive benchmarks

type BenchmarkResult = {
  endpoint: string
  method: string
  description: string
  duration_ms: number
  rows_returned: number
  query_type: 'materialized_view' | 'direct_query' | 'hybrid'
  cache_status: 'hit' | 'miss' | 'not_cached'
  optimization_applied: boolean
  timestamp: Date
}

type PerformanceComparison = {
  endpoint: string
  original_ms: number
  optimized_ms: number
  improvement_percent: number
  queries_reduced: number
  rows_processed: number
}

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
    return new Response(null, { status: 404 })
  }
  const startTime = Date.now()
  const baseLogger = await getSafeServerLogger('performance-benchmark')
  const logger = baseLogger.forRequestWithHeaders
    ? baseLogger.forRequestWithHeaders(request)
    : baseLogger

  try {
    // Verify admin/reviewer role
    const { userId } = await auth()
    if (!userId) {
      const duration = Date.now() - startTime
      trackApiRequest('GET', '/api/performance-benchmark', 401, duration)

      logger.warn('Unauthorized performance benchmark access attempt', {
        operation: 'performance_benchmark',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      })

      return createErrorResponse(new Error('Unauthorized'), 401)
    }

    try {
      await requireRole('reviewer')
    } catch {
      const duration = Date.now() - startTime
      trackApiRequest('GET', '/api/performance-benchmark', 403, duration)

      logger.warn('Insufficient permissions for performance benchmark', {
        operation: 'performance_benchmark',
        userId,
      })

      return createErrorResponse(new Error('Insufficient permissions'), 403)
    }

    const { searchParams } = new URL(request.url)
    const includeComparison = searchParams.get('compare') === 'true'
    const benchmarkType = searchParams.get('type') || 'all'

    logger.info('Starting comprehensive performance benchmarks', {
      operation: 'performance_benchmark_start',
      benchmarkType,
      includeComparison,
      userId,
    })

    const benchmarks: BenchmarkResult[] = []
    const comparisons: PerformanceComparison[] = []

    // 1. Leaderboard Benchmarks
    if (benchmarkType === 'all' || benchmarkType === 'leaderboard') {
      benchmarks.push(...(await benchmarkLeaderboardQueries()))
    }

    // 2. Metrics Benchmarks
    if (benchmarkType === 'all' || benchmarkType === 'metrics') {
      benchmarks.push(...(await benchmarkMetricsQueries()))
    }

    // 3. Analytics Benchmarks
    if (benchmarkType === 'all' || benchmarkType === 'analytics') {
      benchmarks.push(...(await benchmarkAnalyticsQueries()))
    }

    // 4. Dashboard Benchmarks
    if (benchmarkType === 'all' || benchmarkType === 'dashboard') {
      benchmarks.push(...(await benchmarkDashboardQueries()))
    }

    // 5. Stats Benchmarks
    if (benchmarkType === 'all' || benchmarkType === 'stats') {
      benchmarks.push(...(await benchmarkStatsQueries()))
    }

    // 6. Direct vs Materialized View Comparison
    if (includeComparison) {
      comparisons.push(...(await runPerformanceComparisons()))
    }

    // Calculate summary statistics
    const summary = calculateBenchmarkSummary(benchmarks)

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      benchmark_type: benchmarkType,
      summary,
      benchmarks: benchmarks.sort((a, b) => b.duration_ms - a.duration_ms),
      ...(includeComparison && { comparisons }),
      recommendations: generatePerformanceRecommendations(
        benchmarks,
        comparisons,
      ),
      // Metadata for monitoring
      _meta: {
        total_benchmarks: benchmarks.length,
        average_duration_ms: summary.avg_duration_ms,
        slowest_endpoint: benchmarks[0]?.endpoint || 'none',
        fastest_endpoint: benchmarks[benchmarks.length - 1]?.endpoint || 'none',
      },
    }

    const res = createSuccessResponse(response)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.headers.set('X-Performance-Benchmark', 'true')
    res.headers.set('X-Benchmark-Count', benchmarks.length.toString())
    return res
  } catch (err: unknown) {
    const baseLogger = await getSafeServerLogger('performance-benchmark')
    const logger = baseLogger.forRequestWithHeaders
      ? baseLogger.forRequestWithHeaders(request)
      : baseLogger
    const e = normalizeError(err)
    logger.error('Performance benchmark failed', new Error(e.message), {
      operation: 'performance_benchmark',
    })
    return createErrorResponse(
      new Error('Failed to run performance benchmarks'),
      500,
    )
  }
}

async function benchmarkLeaderboardQueries(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // All-time leaderboard (top 50)
  const start1 = Date.now()
  const leaderboard1 = await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points, public_submissions
    FROM leaderboard_totals 
    ORDER BY total_points DESC 
    LIMIT 50
  `
  results.push({
    endpoint: '/api/leaderboard?period=all&limit=50',
    method: 'GET',
    description: 'All-time leaderboard top 50 using materialized view',
    duration_ms: Date.now() - start1,
    rows_returned: Array.isArray(leaderboard1) ? leaderboard1.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  // 30-day leaderboard
  const start2 = Date.now()
  const leaderboard2 = await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points, public_submissions
    FROM leaderboard_30d 
    ORDER BY total_points DESC 
    LIMIT 50
  `
  results.push({
    endpoint: '/api/leaderboard?period=30d&limit=50',
    method: 'GET',
    description: '30-day leaderboard top 50 using materialized view',
    duration_ms: Date.now() - start2,
    rows_returned: Array.isArray(leaderboard2) ? leaderboard2.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  // Search query
  const start3 = Date.now()
  const searchResults = await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points
    FROM leaderboard_totals 
    WHERE name ILIKE '%edu%' OR handle ILIKE '%edu%' 
    ORDER BY total_points DESC 
    LIMIT 20
  `
  results.push({
    endpoint: '/api/leaderboard?search=edu',
    method: 'GET',
    description: 'Leaderboard search with ILIKE on materialized view',
    duration_ms: Date.now() - start3,
    rows_returned: Array.isArray(searchResults) ? searchResults.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  return results
}

async function benchmarkMetricsQueries(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Activity metrics for each LEAPS stage
  const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']

  for (const activity of activities) {
    const start = Date.now()
    const metrics = await prisma.$queryRaw`
      SELECT * FROM activity_metrics WHERE code = ${activity}
    `
    results.push({
      endpoint: `/api/metrics?stage=${activity.toLowerCase()}`,
      method: 'GET',
      description: `${activity} stage metrics from materialized view`,
      duration_ms: Date.now() - start,
      rows_returned: Array.isArray(metrics) ? metrics.length : 0,
      query_type: 'materialized_view',
      cache_status: 'miss',
      optimization_applied: true,
      timestamp: new Date(),
    })
  }

  return results
}

async function benchmarkAnalyticsQueries(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Comprehensive analytics query (optimized version)
  const start1 = Date.now()
  const analyticsData = await prisma.$queryRaw`
    SELECT 
      COUNT(DISTINCT u.id) as total_users,
      COUNT(DISTINCT s.id) as total_submissions,
      COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
      SUM(pl.delta_points) as total_points
    FROM users u
    LEFT JOIN submissions s ON u.id = s.user_id
    LEFT JOIN points_ledger pl ON u.id = pl.user_id
    LIMIT 1
  `
  results.push({
    endpoint: '/admin/api/admin/analytics-optimized',
    method: 'GET',
    description: 'Comprehensive analytics overview (single query)',
    duration_ms: Date.now() - start1,
    rows_returned: Array.isArray(analyticsData) ? analyticsData.length : 0,
    query_type: 'hybrid',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  // Activity distribution
  const start2 = Date.now()
  const activityDist = await prisma.$queryRaw`
    SELECT activity_code, COUNT(*) as count
    FROM submissions
    GROUP BY activity_code
    ORDER BY count DESC
  `
  results.push({
    endpoint: '/admin/api/admin/analytics?type=distribution',
    method: 'GET',
    description: 'Activity distribution aggregation',
    duration_ms: Date.now() - start2,
    rows_returned: Array.isArray(activityDist) ? activityDist.length : 0,
    query_type: 'direct_query',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  return results
}

async function benchmarkDashboardQueries(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Simulate user dashboard query for a test user
  const testUsers = await prisma.user.findMany({ take: 5 })

  for (const user of testUsers) {
    const start = Date.now()

    // Parallel query execution (optimized approach)
    await Promise.all([
      prisma.pointsLedger.aggregate({
        where: { user_id: user.id },
        _sum: { delta_points: true },
      }),

      prisma.submission.findMany({
        where: { user_id: user.id },
        include: { activity: true },
        orderBy: { created_at: 'desc' },
      }),

      prisma.earnedBadge.findMany({
        where: { user_id: user.id },
        include: { badge: true },
        orderBy: { earned_at: 'desc' },
      }),
    ])

    results.push({
      endpoint: '/api/dashboard',
      method: 'GET',
      description: `User dashboard parallel query (user: ${user.handle})`,
      duration_ms: Date.now() - start,
      rows_returned: 3, // 3 main data sets
      query_type: 'hybrid',
      cache_status: 'miss',
      optimization_applied: true,
      timestamp: new Date(),
    })
  }

  return results
}

async function benchmarkStatsQueries(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Platform stats using materialized view
  const start1 = Date.now()
  const platformStats = await prisma.$queryRaw`
    SELECT * FROM platform_stats_overview LIMIT 1
  `
  results.push({
    endpoint: '/api/stats-optimized',
    method: 'GET',
    description: 'Platform statistics from materialized view',
    duration_ms: Date.now() - start1,
    rows_returned: Array.isArray(platformStats) ? platformStats.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  // Cohort performance stats
  const start2 = Date.now()
  const cohortStats = await prisma.$queryRaw`
    SELECT * FROM cohort_performance_stats ORDER BY avg_points_per_user DESC LIMIT 10
  `
  results.push({
    endpoint: '/api/stats-optimized?type=cohorts',
    method: 'GET',
    description: 'Top cohorts performance from materialized view',
    duration_ms: Date.now() - start2,
    rows_returned: Array.isArray(cohortStats) ? cohortStats.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  // Monthly growth trends
  const start3 = Date.now()
  const growthStats = await prisma.$queryRaw`
    SELECT * FROM monthly_growth_stats ORDER BY month DESC LIMIT 12
  `
  results.push({
    endpoint: '/api/stats-optimized?type=growth',
    method: 'GET',
    description: 'Monthly growth trends from materialized view',
    duration_ms: Date.now() - start3,
    rows_returned: Array.isArray(growthStats) ? growthStats.length : 0,
    query_type: 'materialized_view',
    cache_status: 'miss',
    optimization_applied: true,
    timestamp: new Date(),
  })

  return results
}

async function runPerformanceComparisons(): Promise<PerformanceComparison[]> {
  const comparisons: PerformanceComparison[] = []

  // Compare materialized view vs direct aggregation for leaderboard
  const logger = await getSafeServerLogger('performance-benchmark')
  logger.info('Running performance comparisons...', {
    operation: 'performance_benchmark_comparisons',
  })

  // 1. Leaderboard comparison
  const mvStart = Date.now()
  await prisma.$queryRaw`
    SELECT user_id, handle, name, total_points
    FROM leaderboard_totals 
    ORDER BY total_points DESC 
    LIMIT 100
  `
  const mvDuration = Date.now() - mvStart

  const directStart = Date.now()
  await prisma.$queryRaw`
    SELECT 
      u.id as user_id,
      u.handle,
      u.name,
      COALESCE(SUM(pl.delta_points), 0) as total_points
    FROM users u
    LEFT JOIN points_ledger pl ON u.id = pl.user_id
    WHERE u.role = 'PARTICIPANT'
    GROUP BY u.id, u.handle, u.name
    HAVING COALESCE(SUM(pl.delta_points), 0) > 0
    ORDER BY total_points DESC
    LIMIT 100
  `
  const directDuration = Date.now() - directStart

  comparisons.push({
    endpoint: '/api/leaderboard',
    original_ms: directDuration,
    optimized_ms: mvDuration,
    improvement_percent: Math.round(
      ((directDuration - mvDuration) / directDuration) * 100,
    ),
    queries_reduced: 1, // Single query vs aggregation
    rows_processed: 100,
  })

  // 2. Analytics comparison
  const analyticsDirectStart = Date.now()
  await Promise.all([
    prisma.user.count(),
    prisma.submission.count(),
    prisma.pointsLedger.aggregate({ _sum: { delta_points: true } }),
    prisma.submission.groupBy({
      by: ['activity_code', 'status'],
      _count: { id: true },
    }),
  ])
  const analyticsDirectDuration = Date.now() - analyticsDirectStart

  const analyticsOptimizedStart = Date.now()
  await prisma.$queryRaw`SELECT * FROM platform_stats_overview LIMIT 1`
  const analyticsOptimizedDuration = Date.now() - analyticsOptimizedStart

  comparisons.push({
    endpoint: '/admin/api/admin/analytics',
    original_ms: analyticsDirectDuration,
    optimized_ms: analyticsOptimizedDuration,
    improvement_percent: Math.round(
      ((analyticsDirectDuration - analyticsOptimizedDuration) /
        analyticsDirectDuration) *
        100,
    ),
    queries_reduced: 3, // 4 queries reduced to 1
    rows_processed: 1,
  })

  return comparisons
}

function calculateBenchmarkSummary(benchmarks: BenchmarkResult[]) {
  if (benchmarks.length === 0)
    return { total: 0, avg_duration_ms: 0, fastest_ms: 0, slowest_ms: 0 }

  const durations = benchmarks.map((b) => b.duration_ms)
  return {
    total_benchmarks: benchmarks.length,
    avg_duration_ms: Math.round(
      durations.reduce((sum, d) => sum + d, 0) / durations.length,
    ),
    fastest_ms: Math.min(...durations),
    slowest_ms: Math.max(...durations),
    total_rows: benchmarks.reduce((sum, b) => sum + b.rows_returned, 0),
    optimized_queries: benchmarks.filter((b) => b.optimization_applied).length,
    materialized_view_queries: benchmarks.filter(
      (b) => b.query_type === 'materialized_view',
    ).length,
  }
}

function generatePerformanceRecommendations(
  benchmarks: BenchmarkResult[],
  comparisons: PerformanceComparison[],
): string[] {
  const recommendations: string[] = []

  // Analyze benchmark results
  const slowQueries = benchmarks.filter((b) => b.duration_ms > 1000) // > 1 second
  const avgDuration =
    benchmarks.reduce((sum, b) => sum + b.duration_ms, 0) / benchmarks.length

  if (slowQueries.length > 0) {
    recommendations.push(
      `${slowQueries.length} queries are taking >1 second - consider optimization`,
    )
  }

  if (avgDuration > 500) {
    recommendations.push(
      `Average query time is ${Math.round(
        avgDuration,
      )}ms - consider more aggressive caching`,
    )
  }

  const nonOptimized = benchmarks.filter((b) => !b.optimization_applied)
  if (nonOptimized.length > 0) {
    recommendations.push(
      `${nonOptimized.length} endpoints are not yet optimized`,
    )
  }

  // Analyze comparisons if available
  if (comparisons.length > 0) {
    const avgImprovement =
      comparisons.reduce((sum, c) => sum + c.improvement_percent, 0) /
      comparisons.length
    if (avgImprovement > 50) {
      recommendations.push(
        `Materialized views are providing ${Math.round(
          avgImprovement,
        )}% average performance improvement`,
      )
    }
  }

  const mvQueries = benchmarks.filter(
    (b) => b.query_type === 'materialized_view',
  )
  const mvPercentage = (mvQueries.length / benchmarks.length) * 100

  if (mvPercentage < 50) {
    recommendations.push(
      `Only ${Math.round(
        mvPercentage,
      )}% of queries use materialized views - expand coverage`,
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('All performance benchmarks look good! 🚀')
  }

  return recommendations
}
