/**
 * Database utilities for querying analytics materialized views
 * Provides type-safe, performant access to leaderboard and analytics data
 */

import {
  transformRawAnalytics,
  parseLeaderboardEntry,
  parseActivityMetrics,
  parseCohortMetrics,
  parseSchoolMetrics,
  parseTimeSeriesMetrics,
  parseUserPointSummary,
  parseActivityLeaderboardEntry,
  parseUserActivityBreakdown,
  parseDailyAggregateMetrics,
  parseCohortComparison,
  type LeaderboardEntry,
  type ActivityMetrics,
  type CohortMetrics,
  type SchoolMetrics,
  type TimeSeriesMetrics,
  type UserPointSummary,
  type ActivityLeaderboardEntry,
  type UserActivityBreakdown,
  type CohortComparison,
  type AnalyticsFilters,
  type AnalyticsSummary,
  type AnalyticsCacheInfo,
  type RawAnalyticsResult,
} from '@elevate/types'

import { prisma, withDatabaseLogging } from './client'

// =============================================================================
// LEADERBOARD QUERIES
// =============================================================================

/**
 * Get all-time leaderboard with pagination
 */
export async function getLeaderboardTotals(
  limit = 20,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const results = await withDatabaseLogging(
    'get_leaderboard_totals',
    'leaderboard_totals',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM leaderboard_totals
      ORDER BY total_points DESC, last_activity_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
  )
  return transformRawAnalytics(
    results as RawAnalyticsResult,
    parseLeaderboardEntry,
  )
}

/**
 * Get 30-day rolling leaderboard with pagination
 */
export async function getLeaderboard30d(
  limit = 20,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const results = await withDatabaseLogging(
    'get_leaderboard_30d',
    'leaderboard_30d',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM leaderboard_30d
      ORDER BY total_points DESC, last_activity_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
  )
  return transformRawAnalytics(
    results as RawAnalyticsResult,
    parseLeaderboardEntry,
  )
}

/**
 * Get user's position in all-time leaderboard
 */
export async function getUserLeaderboardPosition(userId: string): Promise<{
  allTime: { rank: number; total: number } | null
  thirtyDay: { rank: number; total: number } | null
}> {
  const tuple = await withDatabaseLogging('get_user_leaderboard_position')(() =>
    Promise.all([
      // All-time position
      prisma.$queryRaw<[{ rank: bigint; total: bigint }]>`
        WITH ranked_users AS (
          SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_points DESC, last_activity_at DESC) as rank
          FROM leaderboard_totals
        ),
        user_rank AS (
          SELECT rank FROM ranked_users WHERE user_id = ${userId}
        ),
        total_count AS (
          SELECT COUNT(*) as total FROM leaderboard_totals
        )
        SELECT 
          COALESCE((SELECT rank FROM user_rank), 0) as rank,
          (SELECT total FROM total_count) as total
      `,

      // 30-day position
      prisma.$queryRaw<[{ rank: bigint; total: bigint }]>`
        WITH ranked_users AS (
          SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_points DESC, last_activity_at DESC) as rank
          FROM leaderboard_30d
        ),
        user_rank AS (
          SELECT rank FROM ranked_users WHERE user_id = ${userId}
        ),
        total_count AS (
          SELECT COUNT(*) as total FROM leaderboard_30d
        )
        SELECT 
          COALESCE((SELECT rank FROM user_rank), 0) as rank,
          (SELECT total FROM total_count) as total
      `,
    ]),
  )
  const [allTimeResult, thirtyDayResult] = tuple as [
    { rank: bigint; total: bigint }[],
    { rank: bigint; total: bigint }[],
  ]
  return {
    allTime: allTimeResult[0]
      ? {
          rank: Number(allTimeResult[0].rank),
          total: Number(allTimeResult[0].total),
        }
      : null,
    thirtyDay: thirtyDayResult[0]
      ? {
          rank: Number(thirtyDayResult[0].rank),
          total: Number(thirtyDayResult[0].total),
        }
      : null,
  }
}

// =============================================================================
// ACTIVITY ANALYTICS QUERIES
// =============================================================================

/**
 * Get metrics for all activities
 */
export async function getActivityMetrics(): Promise<ActivityMetrics[]> {
  const results = await withDatabaseLogging(
    'get_activity_metrics',
    'activity_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM activity_metrics
      ORDER BY code
    `,
  )
  return transformRawAnalytics(
    results as RawAnalyticsResult,
    parseActivityMetrics,
  )
}

/**
 * Get metrics for a specific activity
 */
export async function getActivityMetricsById(
  activityCode: string,
): Promise<ActivityMetrics | null> {
  const results = await withDatabaseLogging(
    'get_activity_metrics_by_id',
    'activity_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM activity_metrics
      WHERE code = ${activityCode}
    `,
  )
  const parsed = transformRawAnalytics(
    results as RawAnalyticsResult,
    parseActivityMetrics,
  )
  return parsed.length > 0 ? parsed[0] ?? null : null
}

/**
 * Get leaderboard for a specific activity
 */
export async function getActivityLeaderboard(
  activityCode: string,
  limit = 20,
): Promise<ActivityLeaderboardEntry[]> {
  const results = await withDatabaseLogging('get_activity_leaderboard')(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM get_activity_leaderboard(${activityCode}, ${limit})
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseActivityLeaderboardEntry)
}

// =============================================================================
// COHORT AND SCHOOL ANALYTICS QUERIES
// =============================================================================

/**
 * Get metrics for all cohorts
 */
export async function getCohortMetrics(): Promise<CohortMetrics[]> {
  const results = await withDatabaseLogging(
    'get_cohort_metrics',
    'cohort_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM cohort_metrics
      ORDER BY total_points DESC
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseCohortMetrics)
}

/**
 * Get metrics for a specific cohort
 */
export async function getCohortMetricsById(
  cohort: string,
): Promise<CohortMetrics | null> {
  const results = await withDatabaseLogging(
    'get_cohort_metrics_by_id',
    'cohort_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM cohort_metrics
      WHERE cohort = ${cohort}
    `,
  )
  const parsed = transformRawAnalytics(results as RawAnalyticsResult, parseCohortMetrics)
  return parsed.length > 0 ? parsed[0] ?? null : null
}

/**
 * Get metrics for all schools
 */
export async function getSchoolMetrics(): Promise<SchoolMetrics[]> {
  const results = await withDatabaseLogging(
    'get_school_metrics',
    'school_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM school_metrics
      ORDER BY total_points DESC
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseSchoolMetrics)
}

/**
 * Get metrics for a specific school
 */
export async function getSchoolMetricsById(
  school: string,
): Promise<SchoolMetrics | null> {
  const results = await withDatabaseLogging(
    'get_school_metrics_by_id',
    'school_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM school_metrics
      WHERE school = ${school}
    `,
  )
  const parsed = transformRawAnalytics(results as RawAnalyticsResult, parseSchoolMetrics)
  return parsed.length > 0 ? parsed[0] ?? null : null
}

/**
 * Get cohort comparison data
 */
export async function getCohortComparison(): Promise<CohortComparison[]> {
  const results = await withDatabaseLogging('get_cohort_comparison')(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM get_cohort_comparison()
      ORDER BY total_points DESC
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseCohortComparison)
}

// =============================================================================
// TIME SERIES ANALYTICS QUERIES
// =============================================================================

/**
 * Get time series data for a specific period and activity
 */
export async function getTimeSeriesMetrics(
  days = 30,
  activityCode?: string,
): Promise<TimeSeriesMetrics[]> {
  // Use parameterized queries to prevent SQL injection
  // Using make_interval for safe parameterization
  const query = activityCode
    ? prisma.$queryRaw<RawAnalyticsResult>`
        SELECT * FROM time_series_metrics
        WHERE activity_code = ${activityCode}
        AND date >= CURRENT_DATE - make_interval(days => ${days})
        ORDER BY date DESC, activity_code
      `
    : prisma.$queryRaw<RawAnalyticsResult>`
        SELECT * FROM time_series_metrics
        WHERE date >= CURRENT_DATE - make_interval(days => ${days})
        ORDER BY date DESC, activity_code
      `

  const results = await withDatabaseLogging(
    'get_time_series_metrics',
    'time_series_metrics',
  )(() => query)
  return transformRawAnalytics(results as RawAnalyticsResult, parseTimeSeriesMetrics)
}

/**
 * Get aggregated daily metrics for trend analysis
 */
export async function getDailyAggregateMetrics(days = 30): Promise<
  {
    date: string
    totalSubmissions: number
    totalPoints: number
    totalApprovals: number
    uniqueUsers: number
  }[]
> {
  const results = await withDatabaseLogging(
    'get_daily_aggregate_metrics',
    'time_series_metrics',
  )(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT 
        date::text,
        SUM(submissions_created) as total_submissions,
        SUM(points_awarded) as total_points,
        SUM(submissions_approved) as total_approvals,
        SUM(unique_submitters) as unique_users
      FROM time_series_metrics
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})
      GROUP BY date
      ORDER BY date DESC
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseDailyAggregateMetrics)
}

// =============================================================================
// USER-SPECIFIC ANALYTICS
// =============================================================================

/**
 * Get detailed point summary for a user
 */
export async function getUserPointSummary(
  userId: string,
): Promise<UserPointSummary | null> {
  const results = await withDatabaseLogging('get_user_point_summary')(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      SELECT * FROM get_user_point_summary(${userId})
    `,
  )
  const parsed = transformRawAnalytics(results as RawAnalyticsResult, parseUserPointSummary)
  return parsed.length > 0 ? parsed[0] ?? null : null
}

/**
 * Get user's activity breakdown with rankings
 */
export async function getUserActivityBreakdown(
  userId: string,
): Promise<UserActivityBreakdown[]> {
  const results = await withDatabaseLogging('get_user_activity_breakdown')(
    () =>
      prisma.$queryRaw<RawAnalyticsResult>`
      WITH user_activity_stats AS (
        SELECT 
          a.code as activity_code,
          a.name as activity_name,
          COALESCE(SUM(pl.delta_points), 0) as total_points,
          COUNT(DISTINCT s.id) as submission_count,
          MAX(s.created_at) as last_submission_at
        FROM activities a
        LEFT JOIN points_ledger pl ON a.code = pl.activity_code AND pl.user_id = ${userId}
        LEFT JOIN submissions s ON a.code = s.activity_code AND s.user_id = ${userId}
        GROUP BY a.code, a.name
      ),
      activity_rankings AS (
        SELECT 
          activity_code,
          user_id,
          COALESCE(SUM(pl.delta_points), 0) as user_total_points,
          ROW_NUMBER() OVER (PARTITION BY activity_code ORDER BY COALESCE(SUM(pl.delta_points), 0) DESC) as rank_in_activity
        FROM activities a
        CROSS JOIN users u
        LEFT JOIN points_ledger pl ON a.code = pl.activity_code AND u.id = pl.user_id
        WHERE u.role = 'PARTICIPANT'
        GROUP BY activity_code, user_id
      )
      SELECT 
        uas.activity_code,
        uas.activity_name,
        uas.total_points,
        uas.submission_count,
        uas.last_submission_at,
        COALESCE(ar.rank_in_activity, 0) as rank_in_activity
      FROM user_activity_stats uas
      LEFT JOIN activity_rankings ar ON uas.activity_code = ar.activity_code AND ar.user_id = ${userId}
      ORDER BY uas.total_points DESC
    `,
  )
  return transformRawAnalytics(results as RawAnalyticsResult, parseUserActivityBreakdown)
}

// =============================================================================
// ANALYTICS AGGREGATION QUERIES
// =============================================================================

/**
 * Get comprehensive analytics summary
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  type BasicStats = {
    total_users: bigint
    active_users: bigint
    total_submissions: bigint
    total_points: bigint
  }
  const results = await withDatabaseLogging('get_analytics_summary')(() =>
    Promise.all([
      // Get basic counts
      prisma.$queryRaw<
        [
          {
            total_users: bigint
            active_users: bigint
            total_submissions: bigint
            total_points: bigint
          },
        ]
      >`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN pl.user_id IS NOT NULL OR s.user_id IS NOT NULL THEN u.id END) as active_users,
          COUNT(s.id) as total_submissions,
          COALESCE(SUM(pl.delta_points), 0) as total_points
        FROM users u
        LEFT JOIN points_ledger pl ON u.id = pl.user_id
        LEFT JOIN submissions s ON u.id = s.user_id
        WHERE u.role = 'PARTICIPANT'
      `,

      // Get activity metrics
      getActivityMetrics(),

      // Get top performers
      getLeaderboardTotals(20),
      getLeaderboard30d(20),

      // Get cohort and school data
      getCohortMetrics(),
      getSchoolMetrics(),

      // Get recent trends (last 30 days)
      getTimeSeriesMetrics(30),
    ]))
  const [
    basicStatsArr,
    activityBreakdown,
    topPerformersAllTime,
    topPerformers30d,
    cohortPerformance,
    schoolPerformance,
    recentTrends,
  ] = results as [
    BasicStats[],
    ActivityMetrics[],
    LeaderboardEntry[],
    LeaderboardEntry[],
    CohortMetrics[],
    SchoolMetrics[],
    TimeSeriesMetrics[],
  ]
  const [basicStats] = basicStatsArr

    // Calculate derived statistics
    const totalUsers = Number(basicStats?.total_users || 0)
    const activeUsers = Number(basicStats?.active_users || 0)
    const totalSubmissions = Number(basicStats?.total_submissions || 0)
    const totalPointsAwarded = Number(basicStats?.total_points || 0)

    const approvedSubmissions = activityBreakdown.reduce(
      (sum: number, activity: ActivityMetrics) =>
        sum + activity.approved_submissions,
      0,
    )
    const submissionApprovalRate =
      totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0

    const averagePointsPerUser =
      totalUsers > 0 ? totalPointsAwarded / totalUsers : 0

    const averageSubmissionsPerUser =
      totalUsers > 0 ? totalSubmissions / totalUsers : 0

    const participationRate =
      totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0

    return {
      totalUsers,
      activeUsers,
      totalSubmissions,
      totalPointsAwarded,
      activityBreakdown,
      topPerformersAllTime,
      topPerformers30d,
      cohortPerformance,
      schoolPerformance,
      recentTrends,
      overallStats: {
        submissionApprovalRate: Math.round(submissionApprovalRate * 100) / 100,
        averagePointsPerUser: Math.round(averagePointsPerUser * 100) / 100,
        averageSubmissionsPerUser:
          Math.round(averageSubmissionsPerUser * 100) / 100,
        participationRate: Math.round(participationRate * 100) / 100,
        cohortCount: cohortPerformance.length,
        schoolCount: schoolPerformance.length,
      },
    }
}

// =============================================================================
// MATERIALIZED VIEW REFRESH FUNCTIONS
// =============================================================================

/**
 * Refresh all analytics materialized views
 */
export async function refreshAllAnalytics(): Promise<void> {
  return withDatabaseLogging('refresh_all_analytics')(
    () => prisma.$executeRaw`SELECT refresh_all_analytics()`,
  ).then(() => undefined)
}

/**
 * Refresh specific analytics view
 */
export async function refreshAnalyticsView(viewName: string): Promise<void> {
  // Use switch statement instead of template interpolation to prevent SQL injection
  let query: ReturnType<typeof prisma.$executeRaw>

  switch (viewName) {
    case 'leaderboard_totals':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals`
      break
    case 'leaderboard_30d':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d`
      break
    case 'activity_metrics':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY activity_metrics`
      break
    case 'cohort_metrics':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY cohort_metrics`
      break
    case 'school_metrics':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY school_metrics`
      break
    case 'time_series_metrics':
      query = prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY time_series_metrics`
      break
    default:
      throw new Error(`Invalid view name: ${viewName}`)
  }

  return withDatabaseLogging(
    'refresh_analytics_view',
    viewName,
  )(() => query).then(() => undefined)
}

// =============================================================================
// CACHE INFO AND METADATA
// =============================================================================

/**
 * Get analytics cache information
 */
export function getAnalyticsCacheInfo(): Promise<AnalyticsCacheInfo> {
  // For now, return a mock response since we don't have Redis cache implemented yet
  // In a real implementation, this would check cache timestamps
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const nextRefresh = new Date(now.getTime() + 10 * 60 * 1000)

  return Promise.resolve({
    lastRefresh: fiveMinutesAgo.toISOString(),
    nextScheduledRefresh: nextRefresh.toISOString(),
    dataFreshness: 5, // minutes
    cacheHit: false, // Always false since we're querying directly
  })
}

/**
 * Check if analytics views need refresh based on data staleness
 */
export async function shouldRefreshAnalytics(): Promise<{
  shouldRefresh: boolean
  lastRefresh: Date | null
  stalenessMinutes: number
}> {
  // Query the last update time of materialized views
  const result = await prisma.$queryRaw<
    [
      {
        last_refresh: Date | null
      },
    ]
  >`
    SELECT MAX(GREATEST(
      (SELECT pg_stat_get_last_autoanalyze_time(oid) FROM pg_class WHERE relname = 'leaderboard_totals'),
      (SELECT pg_stat_get_last_autoanalyze_time(oid) FROM pg_class WHERE relname = 'activity_metrics')
    )) as last_refresh
  `

  const lastRefresh = result[0]?.last_refresh || null
  const now = new Date()
  const stalenessMinutes = lastRefresh
    ? Math.floor((now.getTime() - lastRefresh.getTime()) / (1000 * 60))
    : Infinity

  // Refresh if data is older than 15 minutes or never refreshed
  const shouldRefresh = stalenessMinutes > 15

  return {
    shouldRefresh,
    lastRefresh,
    stalenessMinutes: stalenessMinutes === Infinity ? 0 : stalenessMinutes,
  }
}

// =============================================================================
// ANALYTICS QUERY BUILDER
// =============================================================================

/**
 * Build filtered analytics query with common filters
 */
export function buildAnalyticsQuery(
  baseQuery: string,
  filters: AnalyticsFilters = {},
): { query: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.dateRange?.startDate) {
    conditions.push(`created_at >= $${paramIndex}`)
    params.push(filters.dateRange.startDate)
    paramIndex++
  }

  if (filters.dateRange?.endDate) {
    conditions.push(`created_at <= $${paramIndex}`)
    params.push(filters.dateRange.endDate)
    paramIndex++
  }

  if (filters.cohort) {
    conditions.push(`cohort = $${paramIndex}`)
    params.push(filters.cohort)
    paramIndex++
  }

  if (filters.school) {
    conditions.push(`school = $${paramIndex}`)
    params.push(filters.school)
    paramIndex++
  }

  if (filters.activityCode) {
    conditions.push(`activity_code = $${paramIndex}`)
    params.push(filters.activityCode)
    paramIndex++
  }

  let query = baseQuery
  if (conditions.length > 0) {
    const whereClause = conditions.join(' AND ')
    query = query.includes('WHERE')
      ? `${query} AND ${whereClause}`
      : `${query} WHERE ${whereClause}`
  }

  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`
    params.push(filters.limit)
    paramIndex++
  }

  if (filters.offset) {
    query += ` OFFSET $${paramIndex}`
    params.push(filters.offset)
  }

  return { query, params }
}
