import { type NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { formatActivityBreakdown, formatCohortPerformanceStats, formatMonthlyGrowthStats } from '@elevate/logic'


export const runtime = 'nodejs'

// Type definitions
type CohortWithAvgPoints = {
  name: string
  count: number
  avgPoints: number
}

type MonthlyGrowthData = {
  month: string
  educators: number
  submissions: number
}

type PlatformStatsOverview = {
  total_educators: number
  total_participants: number
  active_educators: number
  total_submissions: number
  approved_submissions: number
  pending_submissions: number
  rejected_submissions: number
  total_points_awarded: number
  avg_points_per_award: number
  total_badges_available: number
  total_badges_earned: number
  users_with_badges: number
  activity_breakdown: Record<
    string,
    {
      total: number
      approved: number
      pending: number
      rejected: number
    }
  >
  last_updated: Date
}

export async function GET(request: NextRequest) {
  const baseLogger = await getSafeServerLogger('stats-optimized')
  const logger = baseLogger.forRequestWithHeaders
    ? baseLogger.forRequestWithHeaders(request)
    : baseLogger
  try {
    // Use optimized materialized views for maximum performance
    const [platformStats, cohortStats, monthlyStats, amplifyData] =
      await Promise.all([
        // Get comprehensive platform statistics from materialized view
        prisma.$queryRaw<PlatformStatsOverview[]>`
        SELECT * FROM platform_stats_overview LIMIT 1
      `,

        // Get cohort performance data from materialized view
        prisma.$queryRaw<
          Array<{
            cohort_name: string
            user_count: number
            avg_points_per_user: number
          }>
        >`
        SELECT cohort_name, user_count, avg_points_per_user 
        FROM cohort_performance_stats 
        ORDER BY avg_points_per_user DESC, user_count DESC
        LIMIT 10
      `,

        // Get monthly growth data from materialized view
        prisma.$queryRaw<
          Array<{
            month_label: string
            new_educators: number
            new_submissions: number
          }>
        >`
        SELECT month_label, new_educators, new_submissions
        FROM monthly_growth_stats 
        ORDER BY month DESC
        LIMIT 6
      `,

        // Calculate students impacted from AMPLIFY submissions (optimized)
        prisma.$queryRaw<Array<{ total_students: number }>>`
        SELECT COALESCE(SUM(
          CASE 
            WHEN payload ? 'studentsTrained' THEN (payload->>'studentsTrained')::int
            ELSE 0
          END
        ), 0) as total_students
        FROM submissions 
        WHERE activity_code = 'AMPLIFY' AND status = 'APPROVED'
      `,
      ])

    const stats = platformStats[0]
    if (!stats) {
      throw new Error(
        'Platform statistics not available - materialized views may need refresh',
      )
    }

    const studentsImpacted = amplifyData[0]?.total_students || 0

    // Process stage statistics from activity_breakdown JSON
    // Parse activity breakdown and normalize keys to DTO lower-case shape
    const upper = formatActivityBreakdown(stats.activity_breakdown)
    const empty = { total: 0, approved: 0, pending: 0, rejected: 0 }
    const byStage = {
      learn: upper.LEARN ?? empty,
      explore: upper.EXPLORE ?? empty,
      amplify: upper.AMPLIFY ?? empty,
      present: upper.PRESENT ?? empty,
      shine: upper.SHINE ?? empty,
    }

    // Format cohort data
    const topCohorts: CohortWithAvgPoints[] = formatCohortPerformanceStats(cohortStats)

    // Format monthly growth data
    const monthlyGrowth: MonthlyGrowthData[] = formatMonthlyGrowthStats(monthlyStats)

    const response = {
      totalEducators: Number(stats.total_educators),
      totalSubmissions: Number(stats.total_submissions),
      totalPoints: Number(stats.total_points_awarded),
      studentsImpacted,
      byStage,
      topCohorts,
      monthlyGrowth,
      badges: {
        totalAwarded: Number(stats.total_badges_earned),
        uniqueBadges: Number(stats.total_badges_available),
        mostPopular: [], // Could be enhanced with another materialized view if needed
      },
      // Add cache metadata for debugging
      _meta: {
        lastUpdated: stats.last_updated,
        source: 'materialized_views',
        queryOptimized: true,
      },
    }

    const res = createSuccessResponse(response)
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600',
    )
    res.headers.set('X-Stats-Source', 'materialized-views')
    res.headers.set('X-Stats-Last-Updated', stats.last_updated.toISOString())
    return res
  } catch (error) {
    logger.error('Optimized stats endpoint failed', error instanceof Error ? error : new Error(String(error)), {
      operation: 'stats_optimized',
    })

    // Fallback to original stats calculation if materialized views are not available
    return createErrorResponse(new Error('Failed to fetch statistics'), 500)
  }
}

// Health check for materialized views
export async function HEAD(_request: NextRequest) {
  try {
    const viewStatus = await prisma.$queryRaw<
      Array<{
        view_name: string
        last_updated: Date
        row_count: number
      }>
    >`
      SELECT 
        'platform_stats_overview' as view_name,
        last_updated,
        1 as row_count
      FROM platform_stats_overview
      UNION ALL
      SELECT 
        'cohort_performance_stats' as view_name,
        MIN(last_updated) as last_updated,
        COUNT(*) as row_count
      FROM cohort_performance_stats
      UNION ALL
      SELECT 
        'monthly_growth_stats' as view_name,
        MIN(last_updated) as last_updated,
        COUNT(*) as row_count
      FROM monthly_growth_stats
    `

    const oldestUpdate = viewStatus.reduce((oldest, view) => {
      return !oldest || view.last_updated < oldest ? view.last_updated : oldest
    }, null as Date | null)

    return new Response(null, {
      status: 200,
      headers: {
        'X-Materialized-Views-Count': viewStatus.length.toString(),
        'X-Oldest-View-Update': oldestUpdate?.toISOString() || 'unknown',
        'X-Total-Rows': viewStatus
          .reduce((sum, view) => sum + Number(view.row_count), 0)
          .toString(),
      },
    })
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Error': 'Materialized views unavailable',
      },
    })
  }
}
