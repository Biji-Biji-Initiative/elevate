import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
// Standard envelopes provided via local helpers
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import {
  computeApprovalRate,
  computeActivationRate,
  buildActivityNameMap,
  mapActivityDistribution,
  computeDailySubmissionStats,
  mapPointsByActivityDistribution,
  mapPointsDistributionFromUserTotals,
  mapTopBadges,
  mapReviewerPerformance,
} from '@elevate/logic'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import {
  parseActivityCode,
  AnalyticsQuerySchema,
  // Use local inline filter shapes to avoid tight coupling to types package
  type ActivityCode,
} from '@elevate/types'
import type {
  SubmissionStats,
  UserAnalyticsStats,
  PointsStats,
  BadgeStats,
  ReviewStats,
  StatusDistribution,
  ActivityDistribution,
  RoleDistribution,
  CohortDistribution,
  PointsActivityDistribution,
  PointsDistributionStats,
  DailySubmissionStats,
  DailyRegistrationStats,
  RecentSubmission,
  RecentApproval,
  RecentUser,
  ReviewerPerformance,
  TopBadge,
} from '@elevate/types/common'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  const baseLogger = await getSafeServerLogger('admin-analytics')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      await requireRole('reviewer')
      const _logger = createRequestLogger(baseLogger, request)
      const { searchParams } = new URL(request.url)
      const parsed = AnalyticsQuerySchema.safeParse(
        Object.fromEntries(searchParams),
      )
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid query'))
      }
      const { startDate, endDate, cohort } = parsed.data

      // Build date filter
      const dateFilter: { created_at?: { gte: Date; lte: Date } } = {}
      if (startDate && endDate) {
        dateFilter.created_at = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        }
      }

      // Build cohort filter
      const cohortFilter: { user?: { cohort: string } } = {}
      if (cohort && cohort !== 'ALL') {
        cohortFilter.user = {
          cohort: cohort,
        }
      }

      // Combine filters
      const submissionFilter: {
        created_at?: { gte: Date; lte: Date }
        user?: { cohort: string }
      } = { ...dateFilter, ...cohortFilter }
      const userFilter: { cohort?: string } =
        cohort && cohort !== 'ALL' ? { cohort } : {}

      // Get all analytics data in parallel
      const [
        // Submission statistics
        submissionStats,
        submissionsByStatus,
        submissionsByActivity,
        submissionsByDate,

        // User statistics
        userStats,
        usersByRole,
        usersByCohort,
        userRegistrationsByDate,

        // Points statistics
        pointsStats,
        pointsByActivity,
        pointsDistribution,

        // Recent activity
        recentSubmissions,
        recentApprovals,
        recentUsers,

        // Badge statistics
        badgeStats,
        topBadges,

        // Review statistics
        reviewStats,
        reviewerPerformance,
      ] = await Promise.all([
        // Submission statistics
        getSubmissionStats(submissionFilter),
        getSubmissionsByStatus(submissionFilter),
        getSubmissionsByActivity(submissionFilter),
        getSubmissionsByDate(submissionFilter),

        // User statistics
        getUserStats(userFilter),
        getUsersByRole(userFilter),
        getUsersByCohort(),
        getUserRegistrationsByDate(userFilter),

        // Points statistics
        getPointsStats({
          ...dateFilter,
          ...(cohortFilter.user && { user: cohortFilter.user }),
        }),
        getPointsByActivity({
          ...dateFilter,
          ...(cohortFilter.user && { user: cohortFilter.user }),
        }),
        getPointsDistribution({
          ...(cohortFilter.user && { user: cohortFilter.user }),
        }),

        // Recent activity
        getRecentSubmissions(10),
        getRecentApprovals(10),
        getRecentUsers(10),

        // Badge statistics
        getBadgeStats(),
        getTopBadges(10),

        // Review statistics
        getReviewStats(submissionFilter),
        getReviewerPerformance(),
      ])

      const res = toSuccessResponse({
        overview: {
          submissions: submissionStats,
          users: userStats,
          points: pointsStats,
          badges: badgeStats,
          reviews: reviewStats,
        },
        distributions: {
          submissionsByStatus,
          submissionsByActivity,
          usersByRole,
          usersByCohort,
          pointsByActivity,
          pointsDistribution,
        },
        trends: {
          submissionsByDate,
          userRegistrationsByDate,
        },
        recentActivity: {
          submissions: recentSubmissions,
          approvals: recentApprovals,
          users: recentUsers,
        },
        performance: {
          reviewers: reviewerPerformance,
          topBadges,
        },
      })
      return res
    } catch (error) {
      const logger = createRequestLogger(baseLogger, request)
      logger.error(
        'Admin analytics failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'admin_analytics',
        },
      )
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})

async function getSubmissionStats(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<SubmissionStats> {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.submission.count({ where: filter }),
    prisma.submission.count({ where: { ...filter, status: 'PENDING' } }),
    prisma.submission.count({ where: { ...filter, status: 'APPROVED' } }),
    prisma.submission.count({ where: { ...filter, status: 'REJECTED' } }),
  ])

  const approvalRate = computeApprovalRate(approved, rejected)

  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate: Math.round(approvalRate * 100) / 100,
  }
}

async function getSubmissionsByStatus(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<StatusDistribution[]> {
  const result = await prisma.submission.groupBy({
    by: ['status'],
    where: filter,
    _count: true,
  })

  return result.map((item) => ({
    status: item.status,
    count: item._count,
  }))
}

async function getSubmissionsByActivity(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<ActivityDistribution[]> {
  const result = await prisma.submission.groupBy({
    by: ['activity_code'],
    where: filter,
    _count: true,
    orderBy: {
      _count: {
        activity_code: 'desc',
      },
    },
  })

  // Get activity names
  const activities = await prisma.activity.findMany({
    where: {
      code: { in: result.map((r) => r.activity_code) },
    },
  })

  const activityMap = buildActivityNameMap(activities)
  return mapActivityDistribution(result, activityMap) as ActivityDistribution[]
}

async function getSubmissionsByDate(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<DailySubmissionStats[]> {
  // Get submissions grouped by date (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const dateFilter = {
    ...filter,
    created_at: {
      gte: thirtyDaysAgo,
      ...filter.created_at,
    },
  }

  const submissions = await prisma.submission.findMany({
    where: dateFilter,
    select: {
      created_at: true,
      status: true,
    },
  })

  return computeDailySubmissionStats(submissions)
}

async function getUserStats(filter: {
  cohort?: string
}): Promise<UserAnalyticsStats> {
  const [total, active, withSubmissions, withBadges] = await Promise.all([
    prisma.user.count({ where: filter }),
    prisma.user.count({
      where: {
        ...filter,
        submissions: {
          some: {},
        },
      },
    }),
    prisma.user.count({
      where: {
        ...filter,
        submissions: {
          some: {
            status: 'APPROVED',
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        ...filter,
        earned_badges: {
          some: {},
        },
      },
    }),
  ])

  const activationRate = computeActivationRate(active, total)

  return {
    total,
    active,
    withSubmissions,
    withBadges,
    activationRate: Math.round(activationRate * 100) / 100,
  }
}

async function getUsersByRole(filter: {
  cohort?: string
}): Promise<RoleDistribution[]> {
  const result = await prisma.user.groupBy({
    by: ['role'],
    where: filter,
    _count: true,
    orderBy: {
      _count: {
        role: 'desc',
      },
    },
  })

  return result.map((item) => ({
    role: item.role,
    count: item._count,
  }))
}

async function getUsersByCohort(): Promise<CohortDistribution[]> {
  const result = await prisma.user.groupBy({
    by: ['cohort'],
    _count: true,
    orderBy: {
      _count: {
        cohort: 'desc',
      },
    },
  })

  return result.map((item) => ({
    cohort: item.cohort || 'No Cohort',
    count: item._count,
  }))
}

async function getUserRegistrationsByDate(filter: {
  cohort?: string
}): Promise<DailyRegistrationStats[]> {
  // Get user registrations grouped by date (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const users = await prisma.user.findMany({
    where: {
      ...filter,
      created_at: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      created_at: true,
    },
  })

  // Group by date
  const dailyRegistrations = users.reduce((acc, user) => {
    const date = user.created_at.toISOString().split('T')[0]
    if (!date) return acc // Safety check for noUncheckedIndexedAccess
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(dailyRegistrations)
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function getPointsStats(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<PointsStats> {
  const result = await prisma.pointsLedger.aggregate({
    where: filter,
    _sum: {
      delta_points: true,
    },
    _count: true,
  })

  const avgPointsPerEntry =
    result._count > 0 ? (result._sum.delta_points || 0) / result._count : 0

  return {
    totalAwarded: result._sum.delta_points || 0,
    totalEntries: result._count,
    avgPerEntry: Math.round(avgPointsPerEntry * 100) / 100,
  }
}

async function getPointsByActivity(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<PointsActivityDistribution[]> {
  const result = await prisma.pointsLedger.groupBy({
    by: ['activity_code'],
    where: filter,
    _sum: {
      delta_points: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        delta_points: 'desc',
      },
    },
  })

  // Get activity names
  const activities = await prisma.activity.findMany({
    where: {
      code: { in: result.map((r) => r.activity_code) },
    },
  })

  const activityMap = buildActivityNameMap(activities)
  return mapPointsByActivityDistribution(
    result,
    activityMap,
  ) as PointsActivityDistribution[]
}

async function getPointsDistribution(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<PointsDistributionStats> {
  // Get point totals per user
  const userPoints = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    where: filter,
    _sum: {
      delta_points: true,
    },
  })

  const totals = userPoints.map((up) => up._sum.delta_points || 0)
  return mapPointsDistributionFromUserTotals(totals)
}

async function getRecentSubmissions(
  limit: number,
): Promise<RecentSubmission[]> {
  const submissions = await prisma.submission.findMany({
    take: limit,
    orderBy: {
      created_at: 'desc',
    },
    include: {
      user: {
        select: {
          name: true,
          handle: true,
        },
      },
      activity: {
        select: {
          name: true,
        },
      },
    },
  })

  return submissions.map((sub) => {
    const activityCode = parseActivityCode(sub.activity_code)
    return {
      ...sub,
      activity_code: activityCode || (sub.activity_code as ActivityCode),
    }
  })
}

async function getRecentApprovals(limit: number): Promise<RecentApproval[]> {
  const approvals = await prisma.submission.findMany({
    where: {
      status: 'APPROVED',
    },
    take: limit,
    orderBy: {
      updated_at: 'desc',
    },
    include: {
      user: {
        select: {
          name: true,
          handle: true,
        },
      },
      activity: {
        select: {
          name: true,
        },
      },
    },
  })

  return approvals.map((approval) => {
    const activityCode = parseActivityCode(approval.activity_code)
    return {
      ...approval,
      activity_code: activityCode || (approval.activity_code as ActivityCode),
    }
  })
}

async function getRecentUsers(limit: number): Promise<RecentUser[]> {
  return await prisma.user.findMany({
    take: limit,
    orderBy: {
      created_at: 'desc',
    },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
      role: true,
      created_at: true,
    },
  })
}

async function getBadgeStats(): Promise<BadgeStats> {
  const [totalBadges, totalEarned, uniqueEarners] = await Promise.all([
    prisma.badge.count(),
    prisma.earnedBadge.count(),
    prisma.earnedBadge
      .groupBy({
        by: ['user_id'],
        _count: true,
      })
      .then((result) => result.length),
  ])

  return {
    totalBadges,
    totalEarned,
    uniqueEarners,
  }
}

async function getTopBadges(limit: number): Promise<TopBadge[]> {
  const result = await prisma.earnedBadge.groupBy({
    by: ['badge_code'],
    _count: true,
    orderBy: {
      _count: {
        badge_code: 'desc',
      },
    },
    take: limit,
  })

  const badges: Array<{
    code: string
    name: string
    description: string
    criteria: unknown
    icon_url: string | null
  }> = await prisma.badge.findMany({
    where: {
      code: { in: result.map((r) => r.badge_code) },
    },
  })

  return mapTopBadges(result, badges)
}

async function getReviewStats(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<ReviewStats> {
  const [pending, avgReviewTime] = await Promise.all([
    prisma.submission.count({
      where: {
        ...filter,
        status: 'PENDING',
      },
    }),
    getAverageReviewTime(filter),
  ])

  return {
    pendingReviews: pending,
    avgReviewTimeHours: avgReviewTime,
  }
}

async function getAverageReviewTime(filter: {
  created_at?: { gte: Date; lte: Date }
  user?: { cohort: string }
}): Promise<number> {
  const reviewedSubmissions = await prisma.submission.findMany({
    where: {
      ...filter,
      status: { in: ['APPROVED', 'REJECTED'] },
      reviewer_id: { not: null },
    },
    select: {
      created_at: true,
      updated_at: true,
    },
  })

  if (reviewedSubmissions.length === 0) return 0

  const totalHours = reviewedSubmissions.reduce((sum, sub) => {
    const diffMs = sub.updated_at.getTime() - sub.created_at.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return sum + diffHours
  }, 0)

  return Math.round((totalHours / reviewedSubmissions.length) * 100) / 100
}

async function getReviewerPerformance(): Promise<ReviewerPerformance[]> {
  const reviewers = await prisma.user.findMany({
    where: {
      role: { in: ['REVIEWER', 'ADMIN', 'SUPERADMIN'] },
    },
    select: {
      id: true,
      name: true,
      handle: true,
      role: true,
    },
  })

  const reviewerIds = reviewers.map((r) => r.id)

  const performance = await prisma.submission.groupBy({
    by: ['reviewer_id', 'status'],
    where: {
      reviewer_id: { in: reviewerIds },
      status: { in: ['APPROVED', 'REJECTED'] },
    },
    _count: true,
  })

  const typedReviewers: Array<{
    id: string
    name: string
    handle: string
    role: string
  }> = reviewers
  const typedPerf: Array<{
    reviewer_id: string | null
    status: string
    _count: number
  }> = performance
  return mapReviewerPerformance(
    typedReviewers,
    typedPerf,
  ) as ReviewerPerformance[]
}
