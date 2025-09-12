import type { NextRequest } from 'next/server'

import { Prisma } from '@prisma/client'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse, withApiErrorHandling, type ApiContext } from '@elevate/http'
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

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
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
        const [educators, totalSubmissions, totalPoints, learnersDistinct, amplifySubmissions, storiesShared, microCredentials] = await Promise.all([
          (prisma as any).user?.count
            ? (prisma as any).user.count({ where: { user_type: 'EDUCATOR' } }).catch(() => 0)
            : Promise.resolve(0),
          (prisma as any).submission?.count
            ? (prisma as any).submission.count().catch(() => 0)
            : Promise.resolve(0),
          (prisma as any).pointsLedger?.aggregate
            ? (prisma as any).pointsLedger.aggregate({ _sum: { delta_points: true } }).catch(() => ({ _sum: { delta_points: 0 } }))
            : Promise.resolve({ _sum: { delta_points: 0 } }),
          // Distinct EDU users with LEARN tag grants (approximation via groupBy)
          (prisma as any).learnTagGrant?.groupBy
            ? (prisma as any).learnTagGrant
                .groupBy({ by: ['user_id'] })
                .then((rows: Array<{ user_id: string }>) => rows.length)
                .catch(() => 0)
            : Promise.resolve(0),
          // Approved AMPLIFY submissions to compute peers/students reached
          (prisma as any).submission?.findMany
            ? (prisma as any).submission
                .findMany({
                  where: { activity_code: 'AMPLIFY', status: 'APPROVED' },
                  select: { payload: true },
                })
                .catch(() => [] as Array<{ payload: any }>)
            : Promise.resolve([] as Array<{ payload: any }>),
          // stories_shared: approved PRESENT submissions
          (prisma as any).submission?.count
            ? (prisma as any).submission
                .count({ where: { activity_code: 'PRESENT', status: 'APPROVED' } })
                .catch(() => 0)
            : Promise.resolve(0),
          // micro_credentials: distinct (user, tag) grant pairs
          (prisma as any).learnTagGrant?.count
            ? (prisma as any).learnTagGrant.count().catch(() => 0)
            : Promise.resolve(0),
        ])

        const peersStudentsReached = Array.isArray(amplifySubmissions)
          ? amplifySubmissions.reduce((sum, s) => {
              const p = s?.payload || {}
              const peers = Number((p as any).peers_trained || (p as any).peersTrained || 0)
              const students = Number((p as any).students_trained || (p as any).studentsTrained || 0)
              return sum + peers + students
            }, 0)
          : 0

        const res = createSuccessResponse({
          totalEducators: educators,
          totalSubmissions,
          totalPoints: Number(totalPoints._sum?.delta_points || 0),
          studentsImpacted: peersStudentsReached,
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
          counters: {
            educators_learning: learnersDistinct,
            peers_students_reached: peersStudentsReached,
            stories_shared: storiesShared,
            micro_credentials: microCredentials,
            mce_certified: 0,
          },
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
})
