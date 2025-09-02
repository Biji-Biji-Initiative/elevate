import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { Prisma } from '@prisma/client'
import type { ActivityPayload, ActivityCode } from '@elevate/types'

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

export async function GET(request: NextRequest) {
  try {
    // Get real statistics from database
    const [
      totalEducators,
      totalSubmissions,
      totalPointsResult,
      stageStats,
      topCohorts,
      badgeStats,
      monthlyGrowth
    ] = await Promise.all([
      // Total educators
      prisma.user.count(),
      
      // Total submissions
      prisma.submission.count(),
      
      // Total points awarded
      prisma.pointsLedger.aggregate({
        _sum: { delta_points: true }
      }),
      
      // Stage-wise submission statistics
      prisma.submission.groupBy({
        by: ['activity_code', 'status'],
        _count: { id: true }
      }),
      
      // Top cohorts by user count
      prisma.user.groupBy({
        by: ['cohort'],
        where: { cohort: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),
      
      // Badge statistics
      prisma.earnedBadge.groupBy({
        by: ['badge_code'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),

      // Monthly growth (last 6 months)
      getMonthlyGrowthData()
    ])

    // Calculate students impacted (approximation from AMPLIFY submissions)
    const amplifySubmissions = await prisma.submission.findMany({
      where: { 
        activity_code: 'AMPLIFY',
        status: 'APPROVED' 
      },
      select: { payload: true }
    })

    let studentsImpacted = 0
    amplifySubmissions.forEach(submission => {
      if (submission.payload && typeof submission.payload === 'object') {
        const payload = submission.payload as ActivityPayload
        studentsImpacted += (payload.studentsCount || 0)
      }
    })

    // Process stage statistics
    const byStage: Record<ActivityCode, { submissions: number; avgRating: number }> = {} as Record<ActivityCode, { submissions: number; avgRating: number }>
    const stages = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
    
    stages.forEach(stage => {
      byStage[stage.toLowerCase()] = {
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0
      }
    })

    stageStats.forEach(stat => {
      const stage = stat.activity_code.toLowerCase()
      if (byStage[stage]) {
        byStage[stage][stat.status.toLowerCase()] = stat._count.id
        byStage[stage].total += stat._count.id
      }
    })

    // Get cohort average points using Prisma aggregation
    const cohortsWithAvgPoints: CohortWithAvgPoints[] = await Promise.all(
      topCohorts.map(async (cohort) => {
        // Get all users in this cohort
        const cohortUsers = await prisma.user.findMany({
          where: { cohort: cohort.cohort },
          select: { id: true }
        })
        
        const userIds = cohortUsers.map(u => u.id)
        
        if (userIds.length === 0) {
          return {
            name: cohort.cohort || 'Unknown',
            count: cohort._count.id,
            avgPoints: 0
          }
        }
        
        // Get points for all users in this cohort
        const userPointsData = await prisma.pointsLedger.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: userIds }
          },
          _sum: {
            delta_points: true
          }
        })
        
        // Calculate average
        const totalPoints = userPointsData.reduce((sum, user) => 
          sum + (user._sum.delta_points || 0), 0
        )
        const avgPoints = userPointsData.length > 0 ? totalPoints / userPointsData.length : 0
        
        return {
          name: cohort.cohort || 'Unknown',
          count: cohort._count.id,
          avgPoints
        }
      })
    )

    // Helper function to get monthly growth data
    async function getMonthlyGrowthData(): Promise<MonthlyGrowthData[]> {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      
      const submissions = await prisma.submission.findMany({
        where: {
          created_at: { gte: sixMonthsAgo }
        },
        select: {
          created_at: true,
          user_id: true
        }
      })
      
      // Group by month
      const monthlyData = submissions.reduce((acc, submission) => {
        const monthKey = submission.created_at.toISOString().slice(0, 7) // YYYY-MM format
        if (!acc[monthKey]) {
          acc[monthKey] = {
            educators: new Set<string>(),
            submissions: 0
          }
        }
        acc[monthKey].educators.add(submission.user_id)
        acc[monthKey].submissions++
        return acc
      }, {} as Record<string, { educators: Set<string>; submissions: number }>)
      
      // Convert to array and format
      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          educators: data.educators.size,
          submissions: data.submissions
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    }

    // Get badge details for most popular badges
    const badgeDetails = await prisma.badge.findMany({
      where: {
        code: { in: badgeStats.map(b => b.badge_code) }
      },
      select: { code: true, name: true }
    })

    const mostPopularBadges = badgeStats.map(stat => {
      const badge = badgeDetails.find(b => b.code === stat.badge_code)
      return {
        code: stat.badge_code,
        name: badge?.name || stat.badge_code,
        count: stat._count.id
      }
    })

    const stats = {
      totalEducators,
      totalSubmissions,
      totalPoints: totalPointsResult._sum.delta_points || 0,
      studentsImpacted,
      byStage,
      topCohorts: cohortsWithAvgPoints,
      monthlyGrowth,
      badges: {
        totalAwarded: badgeStats.reduce((sum, stat) => sum + stat._count.id, 0),
        uniqueBadges: badgeStats.length,
        mostPopular: mostPopularBadges
      }
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800' // Cache for 30 minutes
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}