import { type NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'
import { prisma } from '@elevate/db/client'
import { MetricsQuerySchema } from '@elevate/types'

export const runtime = 'nodejs';

// Type definitions
type MonthlyTrendData = {
  month: string;
  submissions: number;
  approvals: number;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = MetricsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid or missing stage parameter' }, { status: 400 })
    }
    const { stage } = parsed.data

    const activityCode = stage.toUpperCase()

    // Get basic submission statistics
    const submissionStats = await prisma.submission.aggregate({
      where: { activity_code: activityCode },
      _count: {
        id: true
      }
    })

    const approvedSubmissions = await prisma.submission.count({
      where: { 
        activity_code: activityCode, 
        status: 'APPROVED' 
      }
    })

    const pendingSubmissions = await prisma.submission.count({
      where: { 
        activity_code: activityCode, 
        status: 'PENDING' 
      }
    })

    const rejectedSubmissions = await prisma.submission.count({
      where: { 
        activity_code: activityCode, 
        status: 'REJECTED' 
      }
    })

    // Count unique educators who submitted for this activity
    const uniqueEducators = await prisma.submission.findMany({
      where: { activity_code: activityCode },
      select: { user_id: true },
      distinct: ['user_id']
    })

    // Get average points earned from points_ledger
    const avgPointsResult = await prisma.pointsLedger.aggregate({
      where: { activity_code: activityCode },
      _avg: { delta_points: true }
    })

    // Get top schools
    const topSchoolsRaw = await prisma.submission.groupBy({
      by: ['user_id'],
      where: { activity_code: activityCode },
      _count: { id: true }
    })

    // Get user schools for top submissions
    const userIds = topSchoolsRaw.map(item => item.user_id)
    const usersWithSchools = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, school: true }
    })

    // Group by school
    const schoolCounts = usersWithSchools.reduce<Record<string, number>>((acc, user) => {
      const school = user.school || 'Unknown School'
      acc[school] = (acc[school] || 0) + 1
      return acc
    }, {})

    const topSchools = Object.entries(schoolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Get cohort breakdown
    const cohortBreakdownRaw = await prisma.submission.groupBy({
      by: ['user_id'],
      where: { activity_code: activityCode },
      _count: { id: true }
    })

    const usersWithCohorts = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, cohort: true }
    })

    const cohortCounts = usersWithCohorts.reduce<Record<string, number>>((acc, user) => {
      const cohort = user.cohort || 'Unknown Cohort'
      acc[cohort] = (acc[cohort] || 0) + 1
      return acc
    }, {})

    const cohortBreakdown = Object.entries(cohortCounts)
      .map(([cohort, count]) => ({ cohort, count }))
      .sort((a, b) => b.count - a.count)

    // Get monthly trend (last 6 months) using Prisma aggregation
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlySubmissions = await prisma.submission.findMany({
      where: {
        activity_code: activityCode,
        created_at: { gte: sixMonthsAgo }
      },
      select: {
        created_at: true,
        status: true
      }
    })

    // Group submissions by month and calculate trend
    const monthlyData = monthlySubmissions.reduce<Record<string, MonthlyTrendData & { sortKey: string }>>((acc, submission) => {
      const date = new Date(submission.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthLabel,
          submissions: 0,
          approvals: 0,
          sortKey: monthKey
        }
      }
      
      acc[monthKey].submissions++
      if (submission.status === 'APPROVED') {
        acc[monthKey].approvals++
      }
      
      return acc
    }, {})

    const monthlyTrend: MonthlyTrendData[] = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...data }) => data)

    const totalSubmissions = submissionStats._count.id
    const completionRate = totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0

    const stageMetrics = {
      stage,
      totalSubmissions,
      approvedSubmissions,
      pendingSubmissions,
      rejectedSubmissions,
      avgPointsEarned: Number(avgPointsResult._avg.delta_points || 0),
      uniqueEducators: uniqueEducators.length,
      completionRate: Number(completionRate.toFixed(2)),
      topSchools,
      cohortBreakdown,
      monthlyTrend
    }

    return NextResponse.json({ success: true, data: stageMetrics }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900' // Cache for 15 minutes
      }
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch metrics data' }, { status: 500 })
  }
}
