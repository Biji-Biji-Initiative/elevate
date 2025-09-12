"use server"
import 'server-only'

import type { AnalyticsQuery } from '@/lib/server/analytics-service'
import { getAnalyticsService } from '@/lib/server/analytics-service'
import type { OverviewStats, Distributions, Trends, RecentActivity, Performance } from '@elevate/types/admin-api-types'

export type AnalyticsData = {
  overview: OverviewStats
  distributions: Distributions
  trends: Trends
  recentActivity: RecentActivity
  performance: Performance
}

export async function getAnalytics(query: AnalyticsQuery): Promise<AnalyticsData> {
  const svc = getAnalyticsService as unknown as (q: AnalyticsQuery) => Promise<AnalyticsData>
  const data = await svc(query)
  return data
}
