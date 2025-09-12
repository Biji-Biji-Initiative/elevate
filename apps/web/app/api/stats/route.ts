import type { NextRequest } from 'next/server'

import { Prisma } from '@prisma/client'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import {
  formatActivityBreakdown,
  formatCohortPerformanceStats,
  formatMonthlyGrowthStats,
} from '@elevate/logic'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return withRateLimit(request, publicApiRateLimiter, async () => {
    const start = Date.now()
    const baseLogger = await getSafeServerLogger('stats')
    const logger = createRequestLogger(baseLogger, request)
    try {
      // Try optimized materialized views first
      const [platformStats, cohortStats, monthlyStats, amplifyData] =
        await Promise.all([
          prisma.$queryRaw<Array<{ [key: string]: any }>>(Prisma.sql`
            SELECT * FROM platform_stats_overview LIMIT 1
          `),
          prisma.$queryRaw<
            Array<{
              cohort_name: string
              user_count: number
              avg_points_per_user: number
            }>
          >(
            Prisma.sql`SELECT cohort_name, user_count, avg_points_per_user FROM cohort_performance_stats ORDER BY avg_points_per_user DESC, user_count DESC LIMIT 10`,
          ),
          prisma.$queryRaw<
            Array<{
              month_label: string
              new_educators: number
              new_submissions: number
            }>
          >(
            Prisma.sql`SELECT month_label, new_educators, new_submissions FROM monthly_growth_stats ORDER BY month DESC LIMIT 6`,
          ),
          prisma.$queryRaw<Array<{ total_students: number }>>(
            Prisma.sql`SELECT COALESCE(SUM(CASE WHEN payload ? 'studentsTrained' THEN (payload->>'studentsTrained')::int ELSE 0 END), 0) as total_students FROM submissions WHERE activity_code = 'AMPLIFY' AND status = 'APPROVED'`,
          ),
        ])

      const stats = platformStats?.[0]
      if (!stats) throw new Error('materialized views unavailable')

      const byStageUpper = formatActivityBreakdown(stats.activity_breakdown)
      const empty = { total: 0, approved: 0, pending: 0, rejected: 0 }
      const byStage = {
        learn: byStageUpper.LEARN ?? empty,
        explore: byStageUpper.EXPLORE ?? empty,
        amplify: byStageUpper.AMPLIFY ?? empty,
        present: byStageUpper.PRESENT ?? empty,
        shine: byStageUpper.SHINE ?? empty,
      }
      const topCohorts = formatCohortPerformanceStats(cohortStats)
      const monthlyGrowth = formatMonthlyGrowthStats(monthlyStats)
      const studentsImpacted = amplifyData?.[0]?.total_students || 0

      const payload = {
        totalEducators: Number(stats.total_educators || 0),
        totalSubmissions: Number(stats.total_submissions || 0),
        totalPoints: Number(stats.total_points_awarded || 0),
        studentsImpacted,
        byStage,
        topCohorts,
        monthlyGrowth,
        badges: {
          totalAwarded: Number(stats.total_badges_earned || 0),
          uniqueBadges: Number(stats.total_badges_available || 0),
          mostPopular: [],
        },
      }

      const res = createSuccessResponse(payload)
      res.headers.set(
        'Cache-Control',
        'public, s-maxage=1800, stale-while-revalidate=3600',
      )
      recordApiAvailability('/api/stats', 'GET', 200)
      recordApiResponseTime('/api/stats', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      // Fallback to a minimal but correctly shaped DTO when views are not available
      logger.warn('Falling back to basic stats', {
        error: error instanceof Error ? error.message : String(error),
      })

      try {
        const [educators, totalSubmissions, totalPoints] = await Promise.all([
          prisma.user.count({ where: { user_type: 'EDUCATOR' } }),
          prisma.submission.count(),
          prisma.pointsLedger.aggregate({ _sum: { delta_points: true } }),
        ])
        const res = createSuccessResponse({
          totalEducators: educators,
          totalSubmissions,
          totalPoints: Number(totalPoints._sum.delta_points || 0),
          studentsImpacted: 0,
          byStage: {
            learn: { total: 0, approved: 0, pending: 0, rejected: 0 },
            explore: { total: 0, approved: 0, pending: 0, rejected: 0 },
            amplify: { total: 0, approved: 0, pending: 0, rejected: 0 },
            present: { total: 0, approved: 0, pending: 0, rejected: 0 },
            shine: { total: 0, approved: 0, pending: 0, rejected: 0 },
          },
          topCohorts: [],
          monthlyGrowth: [],
          badges: { totalAwarded: 0, uniqueBadges: 0, mostPopular: [] },
        })
        res.headers.set('Cache-Control', 'public, s-maxage=300')
        recordApiAvailability('/api/stats', 'GET', 200)
        recordApiResponseTime('/api/stats', 'GET', Date.now() - start, 200)
        return res
      } catch (_e) {
        recordApiAvailability('/api/stats', 'GET', 500)
        recordApiResponseTime('/api/stats', 'GET', Date.now() - start, 500)
        return createErrorResponse(new Error('Failed to fetch statistics'), 500)
      }
    }
  })
}
