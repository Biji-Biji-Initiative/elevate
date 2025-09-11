'use server'
import { getAnalyticsService } from '@/lib/server/analytics-service'
import type { AnalyticsQuery, OverviewStats, Distributions, Trends, RecentActivity, Performance } from '@elevate/types/admin-api-types'

type AnalyticsData = { overview: OverviewStats; distributions: Distributions; trends: Trends; recentActivity: RecentActivity; performance: Performance }

export async function getAnalyticsAction(params: AnalyticsQuery = {}): Promise<AnalyticsData> {
  const getAnalytics = getAnalyticsService as (q: AnalyticsQuery) => Promise<AnalyticsData>
  const input: AnalyticsQuery = {}
  if (params.startDate !== undefined) input.startDate = params.startDate
  if (params.endDate !== undefined) input.endDate = params.endDate
  if (params.cohort !== undefined) input.cohort = params.cohort
  return getAnalytics(input)
}
