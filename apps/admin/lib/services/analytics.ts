"use server"
import 'server-only'

import type { AnalyticsQuery } from '@/lib/server/analytics-service'

export async function getAnalytics(query: AnalyticsQuery) {
  const { getAnalyticsService } = await import('@/lib/server/analytics-service')
  return getAnalyticsService(query)
}
