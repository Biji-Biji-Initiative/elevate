import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'

export async function GET(request: NextRequest) {
  try {
    // Mock data - in production this would aggregate from the database
    const mockStats = {
      totalEducators: 2357,
      totalSubmissions: 3247,
      totalPoints: 185432,
      studentsImpacted: 45678,
      byStage: {
        learn: {
          total: 1247,
          approved: 1124,
          pending: 89,
          rejected: 34
        },
        explore: {
          total: 892,
          approved: 743,
          pending: 112,
          rejected: 37
        },
        amplify: {
          total: 563,
          approved: 467,
          pending: 78,
          rejected: 18
        },
        present: {
          total: 421,
          approved: 367,
          pending: 44,
          rejected: 10
        },
        shine: {
          total: 234,
          approved: 198,
          pending: 31,
          rejected: 5
        }
      },
      topCohorts: [
        { name: 'Jakarta 2024', count: 567, avgPoints: 142.5 },
        { name: 'Surabaya 2024', count: 389, avgPoints: 138.2 },
        { name: 'Bandung 2024', count: 298, avgPoints: 135.7 },
        { name: 'Medan 2024', count: 234, avgPoints: 133.1 },
        { name: 'Yogyakarta 2024', count: 189, avgPoints: 128.9 }
      ],
      monthlyGrowth: [
        { month: '2024-09', educators: 156, submissions: 234 },
        { month: '2024-10', educators: 389, submissions: 567 },
        { month: '2024-11', educators: 678, submissions: 892 },
        { month: '2024-12', educators: 1134, submissions: 1554 }
      ],
      badges: {
        totalAwarded: 892,
        uniqueBadges: 12,
        mostPopular: [
          { code: 'LEARN_MASTER', name: 'Learn Master', count: 234 },
          { code: 'EXPLORER', name: 'Explorer', count: 198 },
          { code: 'AMPLIFIER', name: 'Amplifier', count: 156 }
        ]
      }
    }

    // In production, you would use aggregation queries like:
    /*
    const [
      totalEducators,
      totalSubmissions,
      totalPoints,
      stageStats,
      topCohorts,
      badgeStats
    ] = await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.pointsLedger.aggregate({
        _sum: { delta_points: true }
      }),
      // Stage-wise aggregation
      prisma.submission.groupBy({
        by: ['activity_code', 'status'],
        _count: { id: true }
      }),
      // Top cohorts
      prisma.user.groupBy({
        by: ['cohort'],
        _count: { id: true },
        _avg: { points: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),
      // Badge statistics
      prisma.earnedBadge.groupBy({
        by: ['badge_code'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      })
    ])
    */

    return NextResponse.json(mockStats, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800' // Cache for 30 minutes
      }
    })

  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}