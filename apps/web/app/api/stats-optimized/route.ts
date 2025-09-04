import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@elevate/db/client'
import { parseAmplifyPayload, parseActivityCode, type ActivityCode } from '@elevate/types'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs';

// Type definitions
type CohortWithAvgPoints = {
  name: string;
  count: number;
  avgPoints: number;
};

type MonthlyGrowthData = {
  month: string;
  educators: number;
  submissions: number;
};

type PlatformStatsOverview = {
  total_educators: number;
  total_participants: number;
  active_educators: number;
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  rejected_submissions: number;
  total_points_awarded: number;
  avg_points_per_award: number;
  total_badges_available: number;
  total_badges_earned: number;
  users_with_badges: number;
  activity_breakdown: Record<string, {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  }>;
  last_updated: Date;
};

export async function GET(_request: NextRequest) {
  try {
    // Use optimized materialized views for maximum performance
    const [platformStats, cohortStats, monthlyStats, amplifyData] = await Promise.all([
      // Get comprehensive platform statistics from materialized view
      prisma.$queryRaw<PlatformStatsOverview[]>`
        SELECT * FROM platform_stats_overview LIMIT 1
      `,
      
      // Get cohort performance data from materialized view
      prisma.$queryRaw<Array<{
        cohort_name: string;
        user_count: number;
        avg_points_per_user: number;
      }>>`
        SELECT cohort_name, user_count, avg_points_per_user 
        FROM cohort_performance_stats 
        ORDER BY avg_points_per_user DESC, user_count DESC
        LIMIT 10
      `,
      
      // Get monthly growth data from materialized view
      prisma.$queryRaw<Array<{
        month_label: string;
        new_educators: number;
        new_submissions: number;
      }>>`
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
      `
    ]);

    const stats = platformStats[0];
    if (!stats) {
      throw new Error('Platform statistics not available - materialized views may need refresh');
    }

    const studentsImpacted = amplifyData[0]?.total_students || 0;

    // Process stage statistics from activity_breakdown JSON
    const byStage: Partial<Record<ActivityCode, {
      total: number;
      approved: number;
      pending: number;
      rejected: number;
    }>> = {};

    // Parse activity breakdown from the materialized view
    if (stats.activity_breakdown) {
      Object.entries(stats.activity_breakdown).forEach(([activityCode, counts]) => {
        const parsedCode = parseActivityCode(activityCode);
        if (parsedCode) {
          byStage[parsedCode] = {
            total: counts.total,
            approved: counts.approved,
            pending: counts.pending,
            rejected: counts.rejected
          };
        }
      });
    }

    // Format cohort data
    const topCohorts: CohortWithAvgPoints[] = cohortStats.map(cohort => ({
      name: cohort.cohort_name,
      count: Number(cohort.user_count),
      avgPoints: Math.round(Number(cohort.avg_points_per_user) * 100) / 100
    }));

    // Format monthly growth data
    const monthlyGrowth: MonthlyGrowthData[] = monthlyStats.map(month => ({
      month: month.month_label,
      educators: Number(month.new_educators),
      submissions: Number(month.new_submissions)
    })).reverse(); // Show oldest first

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
        mostPopular: [] // Could be enhanced with another materialized view if needed
      },
      // Add cache metadata for debugging
      _meta: {
        lastUpdated: stats.last_updated,
        source: 'materialized_views',
        queryOptimized: true
      }
    };

    return NextResponse.json({ success: true, data: response }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600', // 30min cache, 1hr stale
        'X-Stats-Source': 'materialized-views',
        'X-Stats-Last-Updated': stats.last_updated.toISOString()
      }
    });

  } catch (error) {
    console.error('Optimized stats endpoint failed:', error);
    
    // Fallback to original stats calculation if materialized views are not available
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch statistics',
      fallback_available: true,
      suggestion: 'Try /api/stats for non-optimized version'
    }, { status: 500 });
  }
}

// Health check for materialized views
export async function HEAD(_request: NextRequest) {
  try {
    const viewStatus = await prisma.$queryRaw<Array<{
      view_name: string;
      last_updated: Date;
      row_count: number;
    }>>`
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
    `;

    const oldestUpdate = viewStatus.reduce((oldest, view) => {
      return !oldest || view.last_updated < oldest ? view.last_updated : oldest;
    }, null as Date | null);

    return new Response(null, {
      status: 200,
      headers: {
        'X-Materialized-Views-Count': viewStatus.length.toString(),
        'X-Oldest-View-Update': oldestUpdate?.toISOString() || 'unknown',
        'X-Total-Rows': viewStatus.reduce((sum, view) => sum + Number(view.row_count), 0).toString()
      }
    });

  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Error': 'Materialized views unavailable'
      }
    });
  }
}