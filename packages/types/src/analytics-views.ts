/**
 * TypeScript types for database analytics views
 * Generated based on the materialized views created in migration 20250904120000
 */

import { z } from 'zod'

import { ActivityCodeSchema } from './common'

// =============================================================================
// LEADERBOARD VIEW TYPES
// =============================================================================

export const LeaderboardEntrySchema = z.object({
  user_id: z.string(),
  handle: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  school: z.string().nullable(),
  cohort: z.string().nullable(),
  total_points: z.number(),
  public_submissions: z.number(),
  total_approved_submissions: z.number(),
  pending_submissions: z.number(),
  last_activity_at: z.date().nullable(),
  first_points_at: z.date().nullable().optional() // Only in leaderboard_totals
})

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>

// Separate schemas for the two different leaderboard views
export const LeaderboardTotalsSchema = LeaderboardEntrySchema
export const Leaderboard30dSchema = LeaderboardEntrySchema.omit({ first_points_at: true })

export type LeaderboardTotals = z.infer<typeof LeaderboardTotalsSchema>
export type Leaderboard30d = z.infer<typeof Leaderboard30dSchema>

// =============================================================================
// ACTIVITY METRICS TYPES
// =============================================================================

export const ActivityMetricsSchema = z.object({
  code: ActivityCodeSchema,
  name: z.string(),
  default_points: z.number(),
  // Submission counts
  total_submissions: z.number(),
  pending_submissions: z.number(),
  approved_submissions: z.number(),
  rejected_submissions: z.number(),
  public_submissions: z.number(),
  // Points metrics
  total_points_awarded: z.number(),
  positive_points_awarded: z.number(),
  negative_points_awarded: z.number(),
  avg_points_per_entry: z.number(),
  // Activity timing
  first_submission_at: z.date().nullable(),
  latest_submission_at: z.date().nullable(),
  // Engagement metrics
  unique_participants: z.number(),
  unique_approved_participants: z.number()
})

export type ActivityMetrics = z.infer<typeof ActivityMetricsSchema>

// =============================================================================
// COHORT METRICS TYPES
// =============================================================================

export const CohortMetricsSchema = z.object({
  cohort: z.string(),
  // Participation counts
  total_participants: z.number(),
  participants_with_points: z.number(),
  participants_with_submissions: z.number(),
  // Points aggregation
  total_points: z.number(),
  avg_points_per_participant: z.number(),
  max_points_in_cohort: z.number(),
  // Submission metrics
  total_submissions: z.number(),
  approved_submissions: z.number(),
  pending_submissions: z.number(),
  public_submissions: z.number(),
  // Activity timeline
  first_activity_at: z.date().nullable(),
  latest_activity_at: z.date().nullable()
})

export type CohortMetrics = z.infer<typeof CohortMetricsSchema>

// =============================================================================
// SCHOOL METRICS TYPES
// =============================================================================

export const SchoolMetricsSchema = z.object({
  school: z.string(),
  // Participation counts
  total_participants: z.number(),
  participants_with_points: z.number(),
  participants_with_submissions: z.number(),
  // Points aggregation
  total_points: z.number(),
  avg_points_per_participant: z.number(),
  max_points_in_school: z.number(),
  // Submission metrics
  total_submissions: z.number(),
  approved_submissions: z.number(),
  pending_submissions: z.number(),
  public_submissions: z.number(),
  // Cohort diversity
  cohort_count: z.number(),
  // Activity timeline
  first_activity_at: z.date().nullable(),
  latest_activity_at: z.date().nullable()
})

export type SchoolMetrics = z.infer<typeof SchoolMetricsSchema>

// =============================================================================
// TIME SERIES METRICS TYPES
// =============================================================================

export const TimeSeriesMetricsSchema = z.object({
  date: z.date(),
  activity_code: ActivityCodeSchema,
  activity_name: z.string(),
  // Points metrics
  points_awarded: z.number(),
  point_entries: z.number(),
  unique_point_users: z.number(),
  // Submission metrics
  submissions_created: z.number(),
  submissions_approved: z.number(),
  submissions_rejected: z.number(),
  unique_submitters: z.number(),
  // Running totals (cumulative)
  cumulative_points: z.number(),
  cumulative_submissions: z.number()
})

export type TimeSeriesMetrics = z.infer<typeof TimeSeriesMetricsSchema>

// =============================================================================
// ANALYTICS HELPER FUNCTION RETURN TYPES
// =============================================================================

export const UserPointSummarySchema = z.object({
  user_id: z.string(),
  total_points: z.number(),
  positive_points: z.number(),
  negative_points: z.number(),
  point_entries: z.number(),
  activities_with_points: z.number(),
  first_points_at: z.date().nullable(),
  latest_points_at: z.date().nullable()
})

export type UserPointSummary = z.infer<typeof UserPointSummarySchema>

export const ActivityLeaderboardEntrySchema = z.object({
  user_id: z.string(),
  handle: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  total_points: z.number(),
  submission_count: z.number(),
  latest_submission_at: z.date().nullable()
})

export type ActivityLeaderboardEntry = z.infer<typeof ActivityLeaderboardEntrySchema>

export const CohortComparisonSchema = z.object({
  cohort: z.string(),
  participant_count: z.number(),
  avg_points_per_user: z.number(),
  total_points: z.number(),
  completion_rate: z.number(), // percentage
  top_user_points: z.number()
})

export type CohortComparison = z.infer<typeof CohortComparisonSchema>

// =============================================================================
// ANALYTICS QUERY FILTERS AND PARAMETERS
// =============================================================================

export const AnalyticsDateRangeSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional()
})

export const AnalyticsFiltersSchema = z.object({
  dateRange: AnalyticsDateRangeSchema.optional(),
  cohort: z.string().optional(),
  school: z.string().optional(),
  activityCode: ActivityCodeSchema.optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional()
})

export type AnalyticsDateRange = z.infer<typeof AnalyticsDateRangeSchema>
export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>

// =============================================================================
// AGGREGATE ANALYTICS RESPONSE TYPES
// =============================================================================

export const AnalyticsSummarySchema = z.object({
  // High-level metrics
  totalUsers: z.number(),
  activeUsers: z.number(),
  totalSubmissions: z.number(),
  totalPointsAwarded: z.number(),
  
  // Breakdown by activity
  activityBreakdown: z.array(ActivityMetricsSchema),
  
  // Leaderboard snapshots
  topPerformersAllTime: z.array(LeaderboardTotalsSchema.optional()).max(20),
  topPerformers30d: z.array(Leaderboard30dSchema.optional()).max(20),
  
  // Cohort and school analytics
  cohortPerformance: z.array(CohortMetricsSchema),
  schoolPerformance: z.array(SchoolMetricsSchema),
  
  // Recent trends (last 30 days of time series)
  recentTrends: z.array(TimeSeriesMetricsSchema).max(30 * 5), // 30 days × 5 activities
  
  // Computed rates and ratios
  overallStats: z.object({
    submissionApprovalRate: z.number(),
    averagePointsPerUser: z.number(),
    averageSubmissionsPerUser: z.number(),
    participationRate: z.number(), // users with submissions / total users
    cohortCount: z.number(),
    schoolCount: z.number()
  })
})

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>

// =============================================================================
// TREND ANALYSIS TYPES
// =============================================================================

export const TrendDataPointSchema = z.object({
  date: z.string(), // ISO date string for JSON serialization
  value: z.number(),
  label: z.string().optional()
})

export const TrendAnalysisSchema = z.object({
  period: z.enum(['7d', '30d', '90d']),
  metric: z.enum(['submissions', 'points', 'users', 'approvals']),
  data: z.array(TrendDataPointSchema),
  summary: z.object({
    total: z.number(),
    average: z.number(),
    growth: z.number(), // percentage change from previous period
    trend: z.enum(['up', 'down', 'stable'])
  })
})

export type TrendDataPoint = z.infer<typeof TrendDataPointSchema>
export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>

// =============================================================================
// COMPARISON ANALYTICS TYPES
// =============================================================================

export const ComparisonMetricsSchema = z.object({
  entity: z.string(), // cohort name, school name, etc.
  entityType: z.enum(['cohort', 'school', 'activity']),
  metrics: z.object({
    totalPoints: z.number(),
    totalSubmissions: z.number(),
    activeParticipants: z.number(),
    approvalRate: z.number(),
    avgPointsPerParticipant: z.number()
  }),
  ranking: z.object({
    pointsRank: z.number(),
    participationRank: z.number(),
    approvalRateRank: z.number()
  }).optional()
})

export type ComparisonMetrics = z.infer<typeof ComparisonMetricsSchema>

// =============================================================================
// HELPER FUNCTIONS FOR TYPE VALIDATION
// =============================================================================

export function parseLeaderboardEntry(data: unknown): LeaderboardEntry | null {
  const result = LeaderboardEntrySchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseActivityMetrics(data: unknown): ActivityMetrics | null {
  const result = ActivityMetricsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseCohortMetrics(data: unknown): CohortMetrics | null {
  const result = CohortMetricsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseSchoolMetrics(data: unknown): SchoolMetrics | null {
  const result = SchoolMetricsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseTimeSeriesMetrics(data: unknown): TimeSeriesMetrics | null {
  const result = TimeSeriesMetricsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseUserPointSummary(data: unknown): UserPointSummary | null {
  const result = UserPointSummarySchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseActivityLeaderboardEntry(data: unknown): ActivityLeaderboardEntry | null {
  const result = ActivityLeaderboardEntrySchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseCohortComparison(data: unknown): CohortComparison | null {
  const result = CohortComparisonSchema.safeParse(data)
  return result.success ? result.data : null
}

// =============================================================================
// ADDITIONAL PARSERS FOR DB-DERIVED ROWS
// =============================================================================

// User activity breakdown (DB row -> API shape)
const UserActivityBreakdownRowSchema = z.object({
  activity_code: z.string(),
  activity_name: z.string(),
  total_points: z.number(),
  submission_count: z.number(),
  last_submission_at: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  rank_in_activity: z.number(),
})

export interface UserActivityBreakdown {
  activityCode: string
  activityName: string
  totalPoints: number
  submissionCount: number
  lastSubmissionAt: Date | null
  rankInActivity: number
}

export function parseUserActivityBreakdown(data: unknown): UserActivityBreakdown | null {
  const result = UserActivityBreakdownRowSchema.safeParse(data)
  if (!result.success) return null
  const row = result.data
  const last = row.last_submission_at
    ? row.last_submission_at instanceof Date
      ? row.last_submission_at
      : new Date(row.last_submission_at)
    : null
  return {
    activityCode: row.activity_code,
    activityName: row.activity_name,
    totalPoints: row.total_points,
    submissionCount: row.submission_count,
    lastSubmissionAt: last,
    rankInActivity: row.rank_in_activity,
  }
}

// Daily aggregate metrics (DB row -> compact dashboard metrics)
const DailyAggregateRowSchema = z.object({
  date: z.union([z.date(), z.string()]),
  total_submissions: z.number().nullable().optional(),
  total_points: z.number().nullable().optional(),
  total_approvals: z.number().nullable().optional(),
  unique_users: z.number().nullable().optional(),
})

export interface DailyAggregateMetrics {
  date: string
  totalSubmissions: number
  totalPoints: number
  totalApprovals: number
  uniqueUsers: number
}

export function parseDailyAggregateMetrics(data: unknown): DailyAggregateMetrics | null {
  const result = DailyAggregateRowSchema.safeParse(data)
  if (!result.success) return null
  const row = result.data
  return {
    date: typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0] ?? '',
    totalSubmissions: Number(row.total_submissions ?? 0),
    totalPoints: Number(row.total_points ?? 0),
    totalApprovals: Number(row.total_approvals ?? 0),
    uniqueUsers: Number(row.unique_users ?? 0),
  }
}

export function parseAnalyticsFilters(data: unknown): AnalyticsFilters | null {
  const result = AnalyticsFiltersSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseAnalyticsSummary(data: unknown): AnalyticsSummary | null {
  const result = AnalyticsSummarySchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseTrendAnalysis(data: unknown): TrendAnalysis | null {
  const result = TrendAnalysisSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseComparisonMetrics(data: unknown): ComparisonMetrics | null {
  const result = ComparisonMetricsSchema.safeParse(data)
  return result.success ? result.data : null
}

// =============================================================================
// UTILITY TYPES FOR API RESPONSES
// =============================================================================

// Type for paginated analytics results
export interface PaginatedAnalytics<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  filters: AnalyticsFilters
  generatedAt: string // ISO timestamp
}

// Type for analytics cache metadata
export interface AnalyticsCacheInfo {
  lastRefresh: string // ISO timestamp
  nextScheduledRefresh: string // ISO timestamp
  dataFreshness: number // minutes since last refresh
  cacheHit: boolean
}

// Combined analytics response with cache info
export interface AnalyticsResponse<T> {
  success: boolean
  data?: T
  error?: string
  cache: AnalyticsCacheInfo
}

// Export utility type for database raw query results
export type RawAnalyticsResult = Record<string, unknown>[]

// Helper to transform raw database results to typed objects
export function transformRawAnalytics<T>(
  rawResults: RawAnalyticsResult,
  parser: (data: unknown) => T | null
): T[] {
  return rawResults.map(parser).filter((item): item is T => item !== null)
}

// =============================================================================
// ANALYTICS CONSTANTS
// =============================================================================

export const ANALYTICS_REFRESH_INTERVALS = {
  LEADERBOARD: 300, // 5 minutes
  ACTIVITY_METRICS: 600, // 10 minutes
  COHORT_METRICS: 1800, // 30 minutes
  SCHOOL_METRICS: 1800, // 30 minutes
  TIME_SERIES: 3600, // 1 hour
} as const

export const ANALYTICS_CACHE_KEYS = {
  LEADERBOARD_TOTALS: 'analytics:leaderboard:totals',
  LEADERBOARD_30D: 'analytics:leaderboard:30d',
  ACTIVITY_METRICS: 'analytics:activity:metrics',
  COHORT_METRICS: 'analytics:cohort:metrics',
  SCHOOL_METRICS: 'analytics:school:metrics',
  TIME_SERIES: 'analytics:timeseries',
  SUMMARY: 'analytics:summary',
} as const

export const MAX_ANALYTICS_RESULTS = {
  LEADERBOARD: 1000,
  TIME_SERIES_DAYS: 90,
  COHORT_LIST: 100,
  SCHOOL_LIST: 500,
  ACTIVITY_LEADERBOARD: 100,
} as const

// Comments explaining business logic
export const ANALYTICS_VIEW_DESCRIPTIONS = {
  LEADERBOARD_TOTALS: 'All-time participant rankings based on cumulative points across all LEAPS activities',
  LEADERBOARD_30D: 'Rolling 30-day participant rankings showing recent activity and engagement',
  ACTIVITY_METRICS: 'Per-activity submission and point statistics with approval rates and participant engagement',
  COHORT_METRICS: 'Cohort-level performance analysis for program evaluation and comparison',
  SCHOOL_METRICS: 'School-level aggregations for institutional participation tracking and geographic analysis',
  TIME_SERIES_METRICS: 'Daily trend data for the last 90 days with cumulative growth tracking',
} as const
