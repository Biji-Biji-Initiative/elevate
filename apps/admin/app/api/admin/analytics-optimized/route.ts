import type { NextRequest } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma, Prisma } from '@elevate/db'
import { createSuccessResponse } from '@elevate/http'
import { computeApprovalRate, computeActivationRate } from '@elevate/logic'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import {
  parseActivityCode,
  AnalyticsQuerySchema,
  type AnalyticsDateFilter,
  // filters are computed inline; do not import unused types
  type SubmissionStats,
  type UserAnalyticsStats,
  type PointsStats,
  type BadgeStats,
  type ReviewStats,
  type StatusDistribution,
  type ActivityDistribution,
  // keep only used domain types
  type RoleDistribution,
  type CohortDistribution,
  type PointsActivityDistribution,
  type PointsDistributionStats,
  type DailySubmissionStats,
  type DailyRegistrationStats,
  type RecentSubmission,
  type RecentApproval,
  type RecentUser,
  type ReviewerPerformance,
  type TopBadge,
} from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const logger: any = console
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    await requireRole('reviewer')
    const { searchParams } = new URL(request.url)
    const parsed = AnalyticsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return createErrorResponse(new Error('Invalid query'), 400)
    }
    const { startDate, endDate, cohort } = parsed.data
    
    // Build filters efficiently
    const dateFilter: AnalyticsDateFilter = {}
    if (startDate && endDate) {
      dateFilter.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }
    
    // Use optimized single queries instead of multiple parallel queries
    const [
      overviewData,
      distributionData,
      trendsData,
      recentActivityData,
      performanceData
    ] = await Promise.all([
      // Single comprehensive overview query
      getOptimizedOverview(dateFilter, cohort),
      
      // Single distribution query  
      getOptimizedDistributions(dateFilter, cohort),
      
      // Single trends query
      getOptimizedTrends(dateFilter, cohort),
      
      // Single recent activity query
      getOptimizedRecentActivity(),
      
      // Single performance metrics query
      getOptimizedPerformanceMetrics()
    ])
    
    const res = createSuccessResponse({
      overview: overviewData,
      distributions: distributionData,
      trends: trendsData,
      recentActivity: recentActivityData,
      performance: performanceData,
      _meta: {
        queryOptimized: true,
        queryCount: 5,
        source: 'optimized_analytics',
        filters: { startDate, endDate, cohort }
      }
    })
    res.headers.set('Cache-Control', 'private, s-maxage=300')
    res.headers.set('X-Analytics-Source', 'optimized-queries')
    return res
    
  } catch (error) {
    logger.error('Optimized analytics failed', error instanceof Error ? error : new Error(String(error)), {
      operation: 'admin_analytics_optimized',
    })
    return createErrorResponse(error, 500)
  }
  })
}

async function getOptimizedOverview(
  dateFilter: AnalyticsDateFilter, 
  cohort?: string
) {
  const cohortCondition = cohort && cohort !== 'ALL' ? Prisma.sql`AND u.cohort = ${cohort}` : Prisma.sql``
  const dateCondition = dateFilter.created_at 
    ? Prisma.sql`AND s.created_at BETWEEN ${dateFilter.created_at.gte} AND ${dateFilter.created_at.lte}`
    : Prisma.sql``
  
  const result = await prisma.$queryRaw<Array<{
    // Submission stats
    total_submissions: bigint
    pending_submissions: bigint  
    approved_submissions: bigint
    rejected_submissions: bigint
    
    // User stats
    total_users: bigint
    active_users: bigint
    users_with_submissions: bigint
    users_with_badges: bigint
    
    // Points stats
    total_points: bigint | null
    avg_points: number | null
    
    // Badge stats
    total_badges_available: bigint
    total_badges_earned: bigint
    unique_badge_earners: bigint
    
    // Review stats
    pending_reviews: bigint
    avg_review_hours: number | null
  }>>`
    WITH base_data AS (
      SELECT 
        u.id as user_id,
        u.role,
        u.cohort,
        u.created_at as user_created_at,
        s.id as submission_id,
        s.status as submission_status,
        s.created_at as submission_created_at,
        s.updated_at as submission_updated_at,
        s.reviewer_id,
        pl.delta_points,
        eb.id as badge_earned_id
      FROM users u
      LEFT JOIN submissions s ON u.id = s.user_id ${dateCondition}
      LEFT JOIN points_ledger pl ON u.id = pl.user_id ${dateFilter.created_at ? Prisma.sql`AND pl.created_at BETWEEN ${dateFilter.created_at.gte} AND ${dateFilter.created_at.lte}` : Prisma.sql``}
      LEFT JOIN earned_badges eb ON u.id = eb.user_id
      WHERE 1=1 ${cohortCondition}
    )
    SELECT 
      -- Submission statistics
      COUNT(submission_id) as total_submissions,
      COUNT(submission_id) FILTER (WHERE submission_status = 'PENDING') as pending_submissions,
      COUNT(submission_id) FILTER (WHERE submission_status = 'APPROVED') as approved_submissions,
      COUNT(submission_id) FILTER (WHERE submission_status = 'REJECTED') as rejected_submissions,
      
      -- User statistics  
      COUNT(DISTINCT user_id) as total_users,
      COUNT(DISTINCT user_id) FILTER (WHERE submission_id IS NOT NULL) as active_users,
      COUNT(DISTINCT user_id) FILTER (WHERE submission_status = 'APPROVED') as users_with_submissions,
      COUNT(DISTINCT user_id) FILTER (WHERE badge_earned_id IS NOT NULL) as users_with_badges,
      
      -- Points statistics
      SUM(delta_points) as total_points,
      AVG(delta_points) FILTER (WHERE delta_points > 0) as avg_points,
      
      -- Badge statistics (system-wide, not filtered)
      (SELECT COUNT(*) FROM badges) as total_badges_available,
      COUNT(DISTINCT badge_earned_id) as total_badges_earned,
      COUNT(DISTINCT user_id) FILTER (WHERE badge_earned_id IS NOT NULL) as unique_badge_earners,
      
      -- Review statistics
      COUNT(submission_id) FILTER (WHERE submission_status = 'PENDING') as pending_reviews,
      AVG(
        CASE 
          WHEN submission_status IN ('APPROVED', 'REJECTED') AND reviewer_id IS NOT NULL
          THEN EXTRACT(EPOCH FROM (submission_updated_at - submission_created_at)) / 3600
          ELSE NULL
        END
      ) as avg_review_hours
      
    FROM base_data
  `
  
  const data = result[0]
  if (!data) throw new Error('No analytics data available')
  
  const totalSubmissions = Number(data.total_submissions)
  const approvedSubmissions = Number(data.approved_submissions)
  const rejectedSubmissions = Number(data.rejected_submissions)
  const approvalRate = computeApprovalRate(approvedSubmissions, rejectedSubmissions)
    
  const totalUsers = Number(data.total_users)
  const activeUsers = Number(data.active_users)
  const activationRate = computeActivationRate(activeUsers, totalUsers)

  return {
    submissions: {
      total: totalSubmissions,
      pending: Number(data.pending_submissions),
      approved: approvedSubmissions,
      rejected: rejectedSubmissions,
      approvalRate: Math.round(approvalRate * 100) / 100
    } as SubmissionStats,
    
    users: {
      total: totalUsers,
      active: activeUsers,
      withSubmissions: Number(data.users_with_submissions),
      withBadges: Number(data.users_with_badges),
      activationRate: Math.round(activationRate * 100) / 100
    } as UserAnalyticsStats,
    
    points: {
      totalAwarded: Number(data.total_points || 0),
      totalEntries: totalSubmissions,
      avgPerEntry: Math.round(Number(data.avg_points || 0) * 100) / 100
    } as PointsStats,
    
    badges: {
      totalBadges: Number(data.total_badges_available),
      totalEarned: Number(data.total_badges_earned),
      uniqueEarners: Number(data.unique_badge_earners)
    } as BadgeStats,
    
    reviews: {
      pendingReviews: Number(data.pending_reviews),
      avgReviewTimeHours: Math.round(Number(data.avg_review_hours || 0) * 100) / 100
    } as ReviewStats
  }
}

async function getOptimizedDistributions(
  dateFilter: AnalyticsDateFilter,
  cohort?: string
) {
  const cohortCondition = cohort && cohort !== 'ALL' ? Prisma.sql`AND u.cohort = ${cohort}` : Prisma.sql``
  const dateCondition = dateFilter.created_at 
    ? Prisma.sql`AND s.created_at BETWEEN ${dateFilter.created_at.gte} AND ${dateFilter.created_at.lte}`
    : Prisma.sql``

  // Single query for all distributions
  const distributionData = await prisma.$queryRaw<Array<{
    category: string
    item: string
    item_name: string | null
    count: bigint
    points: bigint | null
  }>>`
    -- Submission status distribution
    SELECT 
      'status' as category,
      s.status as item,
      s.status as item_name,
      COUNT(*) as count,
      NULL::bigint as points
    FROM submissions s
    JOIN users u ON s.user_id = u.id
    WHERE 1=1 ${dateCondition} ${cohortCondition}
    GROUP BY s.status
    
    UNION ALL
    
    -- Activity distribution with names
    SELECT 
      'activity' as category,
      s.activity_code as item,
      a.name as item_name,
      COUNT(*) as count,
      NULL::bigint as points
    FROM submissions s
    JOIN users u ON s.user_id = u.id
    JOIN activities a ON s.activity_code = a.code
    WHERE 1=1 ${dateCondition} ${cohortCondition}
    GROUP BY s.activity_code, a.name
    ORDER BY count DESC
    
    UNION ALL
    
    -- User role distribution
    SELECT 
      'role' as category,
      u.role as item,
      u.role as item_name,
      COUNT(*) as count,
      NULL::bigint as points
    FROM users u
    WHERE 1=1 ${cohort && cohort !== 'ALL' ? Prisma.sql`AND u.cohort = ${cohort}` : Prisma.sql``}
    GROUP BY u.role
    ORDER BY count DESC
    
    UNION ALL
    
    -- Cohort distribution  
    SELECT 
      'cohort' as category,
      COALESCE(u.cohort, 'No Cohort') as item,
      COALESCE(u.cohort, 'No Cohort') as item_name,
      COUNT(*) as count,
      NULL::bigint as points
    FROM users u
    GROUP BY COALESCE(u.cohort, 'No Cohort')
    ORDER BY count DESC
    
    UNION ALL
    
    -- Points by activity distribution
    SELECT 
      'points_activity' as category,
      pl.activity_code as item,
      a.name as item_name,
      COUNT(*) as count,
      SUM(pl.delta_points) as points
    FROM points_ledger pl
    JOIN activities a ON pl.activity_code = a.code
    ${cohort && cohort !== 'ALL' ? Prisma.sql`JOIN users u ON pl.user_id = u.id AND u.cohort = ${cohort}` : Prisma.sql``}
    WHERE 1=1 ${dateFilter.created_at ? Prisma.sql`AND pl.created_at BETWEEN ${dateFilter.created_at.gte} AND ${dateFilter.created_at.lte}` : Prisma.sql``}
    GROUP BY pl.activity_code, a.name
    ORDER BY points DESC
  `
  
  // Process results into typed distributions
  const statusDist: StatusDistribution[] = []
  const activityDist: ActivityDistribution[] = []
  const roleDist: RoleDistribution[] = []
  const cohortDist: CohortDistribution[] = []
  const pointsActivityDist: PointsActivityDistribution[] = []
  
  distributionData.forEach(row => {
    const count = Number(row.count)
    const points = Number(row.points || 0)
    
    switch (row.category) {
      case 'status':
        statusDist.push({ status: row.item as 'PENDING' | 'APPROVED' | 'REJECTED', count })
        break
      case 'activity':
        const activityCode = parseActivityCode(row.item)
        if (activityCode) {
          activityDist.push({ 
            activity: activityCode, 
            activityName: row.item_name || 'Unknown', 
            count 
          })
        }
        break
      case 'role':
        roleDist.push({ role: row.item as 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN', count })
        break
      case 'cohort':
        cohortDist.push({ cohort: row.item, count })
        break
      case 'points_activity':
        const pointsActivityCode = parseActivityCode(row.item)
        if (pointsActivityCode) {
          pointsActivityDist.push({
            activity: pointsActivityCode,
            activityName: row.item_name || 'Unknown',
            totalPoints: points,
            entries: count
          })
        }
        break
    }
  })
  
  return {
    submissionsByStatus: statusDist,
    submissionsByActivity: activityDist,
    usersByRole: roleDist,
    usersByCohort: cohortDist,
    pointsByActivity: pointsActivityDist,
    pointsDistribution: await getPointsDistribution(dateFilter, cohort) // This needs a separate query
  }
}

async function getPointsDistribution(
  dateFilter: AnalyticsDateFilter,
  cohort?: string
): Promise<PointsDistributionStats> {
  const cohortJoin = cohort && cohort !== 'ALL' ? Prisma.sql`JOIN users u ON pl.user_id = u.id AND u.cohort = ${cohort}` : Prisma.sql``
  const dateCondition = dateFilter.created_at 
    ? Prisma.sql`AND pl.created_at BETWEEN ${dateFilter.created_at.gte} AND ${dateFilter.created_at.lte}`
    : Prisma.sql``
    
  const result = await prisma.$queryRaw<Array<{
    user_total_points: number
  }>>`
    SELECT SUM(pl.delta_points) as user_total_points
    FROM points_ledger pl
    ${cohortJoin}
    WHERE 1=1 ${dateCondition}
    GROUP BY pl.user_id
    ORDER BY user_total_points DESC
  `
  
  const totals = result.map(r => r.user_total_points).filter(t => t > 0)
  
  if (totals.length === 0) {
    return {
      totalUsers: 0,
      max: 0,
      min: 0,
      avg: 0,
      percentiles: []
    }
  }
  
  const percentiles = [10, 25, 50, 75, 90, 95, 99].map(p => {
    const index = Math.floor((p / 100) * (totals.length - 1))
    return {
      percentile: p,
      value: totals[index] || 0
    }
  })
  
  return {
    totalUsers: totals.length,
    max: totals[0] || 0,
    min: totals[totals.length - 1] || 0,
    avg: Math.round((totals.reduce((sum, val) => sum + val, 0) / totals.length) * 100) / 100,
    percentiles
  }
}

async function getOptimizedTrends(
  dateFilter: AnalyticsDateFilter,
  cohort?: string
) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const startDate = dateFilter.created_at?.gte || thirtyDaysAgo
  const endDate = dateFilter.created_at?.lte || new Date()
  
  const cohortJoin = cohort && cohort !== 'ALL' ? Prisma.sql`JOIN users u ON s.user_id = u.id AND u.cohort = ${cohort}` : Prisma.sql``
  const cohortUserJoin = cohort && cohort !== 'ALL' ? Prisma.sql`WHERE u.cohort = ${cohort}` : Prisma.sql`WHERE 1=1`
  
  const [submissionTrends, userTrends] = await Promise.all([
    // Daily submission trends
    prisma.$queryRaw<Array<{
      date: string
      total: bigint
      approved: bigint
      rejected: bigint
      pending: bigint
    }>>`
      SELECT 
        DATE(s.created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE s.status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED') as rejected,
        COUNT(*) FILTER (WHERE s.status = 'PENDING') as pending
      FROM submissions s
      ${cohortJoin}
      WHERE s.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE(s.created_at)
      ORDER BY date
    `,
    
    // Daily user registration trends
    prisma.$queryRaw<Array<{
      date: string
      count: bigint
    }>>`
      SELECT 
        DATE(u.created_at) as date,
        COUNT(*) as count
      FROM users u
      ${cohortUserJoin} AND u.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE(u.created_at)
      ORDER BY date
    `
  ])
  
  return {
    submissionsByDate: submissionTrends.map(row => ({
      date: row.date,
      total: Number(row.total),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
      pending: Number(row.pending)
    })) as DailySubmissionStats[],
    
    userRegistrationsByDate: userTrends.map(row => ({
      date: row.date,
      count: Number(row.count)
    })) as DailyRegistrationStats[]
  }
}

async function getOptimizedRecentActivity() {
  // Single query for all recent activity
  const recentData = await prisma.$queryRaw<Array<{
    category: string
    id: string
    user_name: string
    user_handle: string
    user_email: string | null
    user_role: string | null
    activity_code: string | null
    activity_name: string | null
    status: string | null
    created_at: Date
    updated_at: Date | null
  }>>`
    -- Recent submissions
    SELECT 
      'submission' as category,
      s.id::text as id,
      u.name as user_name,
      u.handle as user_handle,
      u.email as user_email,
      u.role as user_role,
      s.activity_code,
      a.name as activity_name,
      s.status,
      s.created_at,
      s.updated_at
    FROM submissions s
    JOIN users u ON s.user_id = u.id
    JOIN activities a ON s.activity_code = a.code
    ORDER BY s.created_at DESC
    LIMIT 10
    
    UNION ALL
    
    -- Recent approvals
    SELECT 
      'approval' as category,
      s.id::text as id,
      u.name as user_name,
      u.handle as user_handle,
      u.email as user_email,
      u.role as user_role,
      s.activity_code,
      a.name as activity_name,
      s.status,
      s.created_at,
      s.updated_at
    FROM submissions s
    JOIN users u ON s.user_id = u.id
    JOIN activities a ON s.activity_code = a.code
    WHERE s.status = 'APPROVED'
    ORDER BY s.updated_at DESC
    LIMIT 10
    
    UNION ALL
    
    -- Recent users
    SELECT 
      'user' as category,
      u.id::text as id,
      u.name as user_name,
      u.handle as user_handle,
      u.email as user_email,
      u.role as user_role,
      NULL as activity_code,
      NULL as activity_name,
      NULL as status,
      u.created_at,
      NULL as updated_at
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT 10
  `
  
  const submissions: RecentSubmission[] = []
  const approvals: RecentApproval[] = []
  const users: RecentUser[] = []
  
  recentData.forEach(row => {
    switch (row.category) {
      case 'submission':
        const submissionActivityCode = parseActivityCode(row.activity_code || '')
        if (submissionActivityCode) {
          submissions.push({
            id: row.id,
            user_id: row.id, // Note: This should be user_id from the query
            activity_code: submissionActivityCode,
            status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
            created_at: row.created_at,
            updated_at: row.updated_at || row.created_at,
            user: {
              name: row.user_name,
              handle: row.user_handle
            },
            activity: {
              name: row.activity_name || 'Unknown'
            }
          })
        }
        break
        
      case 'approval':
        const approvalActivityCode = parseActivityCode(row.activity_code || '')
        if (approvalActivityCode) {
          approvals.push({
            id: row.id,
            user_id: row.id, // Note: This should be user_id from the query
            activity_code: approvalActivityCode,
            status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
            created_at: row.created_at,
            updated_at: row.updated_at || row.created_at,
            user: {
              name: row.user_name,
              handle: row.user_handle
            },
            activity: {
              name: row.activity_name || 'Unknown'
            }
          })
        }
        break
        
      case 'user':
        users.push({
          id: row.id,
          name: row.user_name,
          handle: row.user_handle,
          email: row.user_email || '',
          role: row.user_role as 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN',
          created_at: row.created_at
        })
        break
    }
  })
  
  return {
    submissions: submissions.slice(0, 10),
    approvals: approvals.slice(0, 10), 
    users: users.slice(0, 10)
  }
}

async function getOptimizedPerformanceMetrics() {
  // Get reviewer performance and top badges in a single query when possible
  const [reviewerPerformance, topBadges] = await Promise.all([
    // Reviewer performance
    prisma.$queryRaw<Array<{
      id: string
      name: string
      handle: string
      role: string
      approved: bigint
      rejected: bigint
      total: bigint
    }>>`
      SELECT 
        u.id,
        u.name,
        u.handle,
        u.role,
        COUNT(*) FILTER (WHERE s.status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED') as rejected,
        COUNT(*) as total
      FROM users u
      JOIN submissions s ON u.id = s.reviewer_id
      WHERE u.role IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
        AND s.status IN ('APPROVED', 'REJECTED')
      GROUP BY u.id, u.name, u.handle, u.role
      HAVING COUNT(*) > 0
      ORDER BY total DESC
    `,
    
    // Top badges
    prisma.$queryRaw<Array<{
      badge_code: string
      badge_name: string
      badge_description: string
      badge_criteria: unknown
      badge_icon_url: string | null
      earned_count: bigint
    }>>`
      SELECT 
        b.code as badge_code,
        b.name as badge_name,
        b.description as badge_description,
        b.criteria as badge_criteria,
        b.icon_url as badge_icon_url,
        COUNT(eb.id) as earned_count
      FROM badges b
      LEFT JOIN earned_badges eb ON b.code = eb.badge_code
      GROUP BY b.code, b.name, b.description, b.criteria, b.icon_url
      ORDER BY earned_count DESC
      LIMIT 10
    `
  ])
  
  return {
    reviewers: reviewerPerformance.map(r => ({
      id: r.id,
      name: r.name,
      handle: r.handle,
      role: r.role,
      approved: Number(r.approved),
      rejected: Number(r.rejected),
      total: Number(r.total)
    })) as ReviewerPerformance[],
    
    topBadges: topBadges.map(b => ({
      badge: {
        code: b.badge_code,
        name: b.badge_name,
        description: b.badge_description,
        criteria: b.badge_criteria || {},
        icon_url: b.badge_icon_url || ''
      },
      earnedCount: Number(b.earned_count)
    })) as TopBadge[]
  }
}
