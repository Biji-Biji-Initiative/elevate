import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')
    
    if (!stage || !['learn', 'explore', 'amplify', 'present', 'shine'].includes(stage)) {
      return NextResponse.json(
        { error: 'Invalid or missing stage parameter' },
        { status: 400 }
      )
    }

    // Mock metrics data - in production this would query materialized views
    const mockMetrics = {
      learn: {
        stage: 'learn',
        totalSubmissions: 1247,
        approvedSubmissions: 1124,
        pendingSubmissions: 89,
        rejectedSubmissions: 34,
        avgPointsEarned: 19.2,
        uniqueEducators: 1089,
        completionRate: 90.1,
        topSchools: [
          { name: 'SMA Negeri 1 Jakarta', count: 45 },
          { name: 'SMA Negeri 2 Surabaya', count: 38 },
          { name: 'SMA Negeri 1 Bandung', count: 32 }
        ],
        cohortBreakdown: [
          { cohort: 'Jakarta 2024', count: 312 },
          { cohort: 'Surabaya 2024', count: 198 },
          { cohort: 'Bandung 2024', count: 156 }
        ],
        monthlyTrend: [
          { month: 'Sep 2024', submissions: 145, approvals: 132 },
          { month: 'Oct 2024', submissions: 289, approvals: 261 },
          { month: 'Nov 2024', submissions: 356, approvals: 324 },
          { month: 'Dec 2024', submissions: 457, approvals: 407 }
        ]
      }
    }

    // Generate scaled data for other stages
    const baseMetrics = mockMetrics.learn
    const scaleFactor = stage === 'explore' ? 0.7 : stage === 'amplify' ? 0.5 : stage === 'present' ? 0.4 : 0.3
    
    const stageMetrics = stage === 'learn' ? mockMetrics.learn : {
      ...baseMetrics,
      stage,
      totalSubmissions: Math.floor(baseMetrics.totalSubmissions * scaleFactor),
      approvedSubmissions: Math.floor(baseMetrics.approvedSubmissions * scaleFactor),
      pendingSubmissions: Math.floor(baseMetrics.pendingSubmissions * scaleFactor),
      rejectedSubmissions: Math.floor(baseMetrics.rejectedSubmissions * scaleFactor),
      uniqueEducators: Math.floor(baseMetrics.uniqueEducators * scaleFactor),
      avgPointsEarned: stage === 'explore' ? 47.8 : stage === 'amplify' ? 35.6 : 19.2,
      topSchools: baseMetrics.topSchools.map(school => ({
        ...school,
        count: Math.floor(school.count * scaleFactor)
      })),
      cohortBreakdown: baseMetrics.cohortBreakdown.map(cohort => ({
        ...cohort,
        count: Math.floor(cohort.count * scaleFactor)
      })),
      monthlyTrend: baseMetrics.monthlyTrend.map(month => ({
        ...month,
        submissions: Math.floor(month.submissions * scaleFactor),
        approvals: Math.floor(month.approvals * scaleFactor)
      }))
    }

    // In production, you would use something like:
    /*
    const metrics = await prisma.$queryRaw`
      SELECT 
        activity_code as stage,
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_submissions,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_submissions,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_submissions,
        AVG(CASE WHEN status = 'APPROVED' THEN points_awarded END) as avg_points_earned,
        COUNT(DISTINCT user_id) as unique_educators
      FROM submissions s
      LEFT JOIN activities a ON s.activity_code = a.code
      WHERE s.activity_code = ${stage.toUpperCase()}
      GROUP BY activity_code
    `
    */

    return NextResponse.json(stageMetrics, {
      headers: {
        'Cache-Control': 'public, s-maxage=900' // Cache for 15 minutes
      }
    })

  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics data' },
      { status: 500 }
    )
  }
}
