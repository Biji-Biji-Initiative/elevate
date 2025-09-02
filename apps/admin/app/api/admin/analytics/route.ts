import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole } from '@elevate/auth/withRole'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('reviewer')
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate') 
    const cohort = searchParams.get('cohort')
    
    // Build date filter
    const dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }
    
    // Build cohort filter
    const cohortFilter: any = {}
    if (cohort && cohort !== 'ALL') {
      cohortFilter.user = {
        cohort: cohort
      }
    }
    
    // Combine filters
    const submissionFilter = { ...dateFilter, ...cohortFilter }
    const userFilter = cohort && cohort !== 'ALL' ? { cohort } : {}
    
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
      reviewerPerformance
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
      getPointsStats({ ...dateFilter, user: cohortFilter.user }),
      getPointsByActivity({ ...dateFilter, user: cohortFilter.user }),
      getPointsDistribution({ user: cohortFilter.user }),
      
      // Recent activity
      getRecentSubmissions(10),
      getRecentApprovals(10),
      getRecentUsers(10),
      
      // Badge statistics
      getBadgeStats(),
      getTopBadges(10),
      
      // Review statistics
      getReviewStats(submissionFilter),
      getReviewerPerformance()
    ])
    
    return NextResponse.json({
      overview: {
        submissions: submissionStats,
        users: userStats,
        points: pointsStats,
        badges: badgeStats,
        reviews: reviewStats
      },
      distributions: {
        submissionsByStatus,
        submissionsByActivity,
        usersByRole,
        usersByCohort,
        pointsByActivity,
        pointsDistribution
      },
      trends: {
        submissionsByDate,
        userRegistrationsByDate
      },
      recentActivity: {
        submissions: recentSubmissions,
        approvals: recentApprovals,
        users: recentUsers
      },
      performance: {
        reviewers: reviewerPerformance,
        topBadges
      }
    })
  } catch (error: any) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: error.statusCode || 500 }
    )
  }
}

async function getSubmissionStats(filter: any) {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.submission.count({ where: filter }),
    prisma.submission.count({ where: { ...filter, status: 'PENDING' } }),
    prisma.submission.count({ where: { ...filter, status: 'APPROVED' } }),
    prisma.submission.count({ where: { ...filter, status: 'REJECTED' } })
  ])
  
  const approvalRate = total > 0 ? ((approved / (approved + rejected)) * 100) : 0
  
  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate: Math.round(approvalRate * 100) / 100
  }
}

async function getSubmissionsByStatus(filter: any) {
  const result = await prisma.submission.groupBy({
    by: ['status'],
    where: filter,
    _count: true
  })
  
  return result.map(item => ({
    status: item.status,
    count: item._count
  }))
}

async function getSubmissionsByActivity(filter: any) {
  const result = await prisma.submission.groupBy({
    by: ['activity_code'],
    where: filter,
    _count: true,
    orderBy: {
      _count: {
        activity_code: 'desc'
      }
    }
  })
  
  // Get activity names
  const activities = await prisma.activity.findMany({
    where: {
      code: { in: result.map(r => r.activity_code) }
    }
  })
  
  const activityMap = activities.reduce((acc, activity) => {
    acc[activity.code] = activity.name
    return acc
  }, {} as Record<string, string>)
  
  return result.map(item => ({
    activity: item.activity_code,
    activityName: activityMap[item.activity_code],
    count: item._count
  }))
}

async function getSubmissionsByDate(filter: any) {
  // Get submissions grouped by date (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const dateFilter = {
    ...filter,
    created_at: {
      gte: thirtyDaysAgo,
      ...filter.created_at
    }
  }
  
  const submissions = await prisma.submission.findMany({
    where: dateFilter,
    select: {
      created_at: true,
      status: true
    }
  })
  
  // Group by date
  const dailyStats = submissions.reduce((acc, sub) => {
    const date = sub.created_at.toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = { total: 0, approved: 0, rejected: 0, pending: 0 }
    }
    acc[date].total++
    acc[date][sub.status.toLowerCase()]++
    return acc
  }, {} as Record<string, any>)
  
  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    ...stats
  })).sort((a, b) => a.date.localeCompare(b.date))
}

async function getUserStats(filter: any) {
  const [total, active, withSubmissions, withBadges] = await Promise.all([
    prisma.user.count({ where: filter }),
    prisma.user.count({ 
      where: {
        ...filter,
        submissions: {
          some: {}
        }
      }
    }),
    prisma.user.count({
      where: {
        ...filter,
        submissions: {
          some: {
            status: 'APPROVED'
          }
        }
      }
    }),
    prisma.user.count({
      where: {
        ...filter,
        earned_badges: {
          some: {}
        }
      }
    })
  ])
  
  const activationRate = total > 0 ? ((active / total) * 100) : 0
  
  return {
    total,
    active,
    withSubmissions,
    withBadges,
    activationRate: Math.round(activationRate * 100) / 100
  }
}

async function getUsersByRole(filter: any) {
  const result = await prisma.user.groupBy({
    by: ['role'],
    where: filter,
    _count: true,
    orderBy: {
      _count: {
        role: 'desc'
      }
    }
  })
  
  return result.map(item => ({
    role: item.role,
    count: item._count
  }))
}

async function getUsersByCohort() {
  const result = await prisma.user.groupBy({
    by: ['cohort'],
    _count: true,
    orderBy: {
      _count: {
        cohort: 'desc'
      }
    }
  })
  
  return result.map(item => ({
    cohort: item.cohort || 'No Cohort',
    count: item._count
  }))
}

async function getUserRegistrationsByDate(filter: any) {
  // Get user registrations grouped by date (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const users = await prisma.user.findMany({
    where: {
      ...filter,
      created_at: {
        gte: thirtyDaysAgo
      }
    },
    select: {
      created_at: true
    }
  })
  
  // Group by date
  const dailyRegistrations = users.reduce((acc, user) => {
    const date = user.created_at.toISOString().split('T')[0]
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return Object.entries(dailyRegistrations).map(([date, count]) => ({
    date,
    count
  })).sort((a, b) => a.date.localeCompare(b.date))
}

async function getPointsStats(filter: any) {
  const result = await prisma.pointsLedger.aggregate({
    where: filter,
    _sum: {
      delta_points: true
    },
    _count: true
  })
  
  const avgPointsPerEntry = result._count > 0 ? (result._sum.delta_points || 0) / result._count : 0
  
  return {
    totalAwarded: result._sum.delta_points || 0,
    totalEntries: result._count,
    avgPerEntry: Math.round(avgPointsPerEntry * 100) / 100
  }
}

async function getPointsByActivity(filter: any) {
  const result = await prisma.pointsLedger.groupBy({
    by: ['activity_code'],
    where: filter,
    _sum: {
      delta_points: true
    },
    _count: true,
    orderBy: {
      _sum: {
        delta_points: 'desc'
      }
    }
  })
  
  // Get activity names
  const activities = await prisma.activity.findMany({
    where: {
      code: { in: result.map(r => r.activity_code) }
    }
  })
  
  const activityMap = activities.reduce((acc, activity) => {
    acc[activity.code] = activity.name
    return acc
  }, {} as Record<string, string>)
  
  return result.map(item => ({
    activity: item.activity_code,
    activityName: activityMap[item.activity_code],
    totalPoints: item._sum.delta_points || 0,
    entries: item._count
  }))
}

async function getPointsDistribution(filter: any) {
  // Get point totals per user
  const userPoints = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    where: filter,
    _sum: {
      delta_points: true
    }
  })
  
  const totals = userPoints.map(up => up._sum.delta_points || 0).sort((a, b) => b - a)
  
  // Calculate distribution percentiles
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
    avg: totals.length > 0 ? Math.round((totals.reduce((sum, val) => sum + val, 0) / totals.length) * 100) / 100 : 0,
    percentiles
  }
}

async function getRecentSubmissions(limit: number) {
  return await prisma.submission.findMany({
    take: limit,
    orderBy: {
      created_at: 'desc'
    },
    include: {
      user: {
        select: {
          name: true,
          handle: true
        }
      },
      activity: {
        select: {
          name: true
        }
      }
    }
  })
}

async function getRecentApprovals(limit: number) {
  return await prisma.submission.findMany({
    where: {
      status: 'APPROVED'
    },
    take: limit,
    orderBy: {
      updated_at: 'desc'
    },
    include: {
      user: {
        select: {
          name: true,
          handle: true
        }
      },
      activity: {
        select: {
          name: true
        }
      }
    }
  })
}

async function getRecentUsers(limit: number) {
  return await prisma.user.findMany({
    take: limit,
    orderBy: {
      created_at: 'desc'
    },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
      role: true,
      created_at: true
    }
  })
}

async function getBadgeStats() {
  const [totalBadges, totalEarned, uniqueEarners] = await Promise.all([
    prisma.badge.count(),
    prisma.earnedBadge.count(),
    prisma.earnedBadge.groupBy({
      by: ['user_id'],
      _count: true
    }).then(result => result.length)
  ])
  
  return {
    totalBadges,
    totalEarned,
    uniqueEarners
  }
}

async function getTopBadges(limit: number) {
  const result = await prisma.earnedBadge.groupBy({
    by: ['badge_code'],
    _count: true,
    orderBy: {
      _count: {
        badge_code: 'desc'
      }
    },
    take: limit
  })
  
  const badges = await prisma.badge.findMany({
    where: {
      code: { in: result.map(r => r.badge_code) }
    }
  })
  
  const badgeMap = badges.reduce((acc, badge) => {
    acc[badge.code] = badge
    return acc
  }, {} as Record<string, any>)
  
  return result.map(item => ({
    badge: badgeMap[item.badge_code],
    earnedCount: item._count
  }))
}

async function getReviewStats(filter: any) {
  const [pending, avgReviewTime] = await Promise.all([
    prisma.submission.count({
      where: {
        ...filter,
        status: 'PENDING'
      }
    }),
    getAverageReviewTime(filter)
  ])
  
  return {
    pendingReviews: pending,
    avgReviewTimeHours: avgReviewTime
  }
}

async function getAverageReviewTime(filter: any) {
  const reviewedSubmissions = await prisma.submission.findMany({
    where: {
      ...filter,
      status: { in: ['APPROVED', 'REJECTED'] },
      reviewer_id: { not: null }
    },
    select: {
      created_at: true,
      updated_at: true
    }
  })
  
  if (reviewedSubmissions.length === 0) return 0
  
  const totalHours = reviewedSubmissions.reduce((sum, sub) => {
    const diffMs = sub.updated_at.getTime() - sub.created_at.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return sum + diffHours
  }, 0)
  
  return Math.round((totalHours / reviewedSubmissions.length) * 100) / 100
}

async function getReviewerPerformance() {
  const reviewers = await prisma.user.findMany({
    where: {
      role: { in: ['REVIEWER', 'ADMIN', 'SUPERADMIN'] }
    },
    select: {
      id: true,
      name: true,
      handle: true,
      role: true
    }
  })
  
  const reviewerIds = reviewers.map(r => r.id)
  
  const performance = await prisma.submission.groupBy({
    by: ['reviewer_id', 'status'],
    where: {
      reviewer_id: { in: reviewerIds },
      status: { in: ['APPROVED', 'REJECTED'] }
    },
    _count: true
  })
  
  const reviewerMap = reviewers.reduce((acc, reviewer) => {
    acc[reviewer.id] = {
      ...reviewer,
      approved: 0,
      rejected: 0,
      total: 0
    }
    return acc
  }, {} as Record<string, any>)
  
  performance.forEach(p => {
    if (p.reviewer_id && reviewerMap[p.reviewer_id]) {
      reviewerMap[p.reviewer_id][p.status.toLowerCase()] = p._count
      reviewerMap[p.reviewer_id].total += p._count
    }
  })
  
  return Object.values(reviewerMap)
    .filter((r: any) => r.total > 0)
    .sort((a: any, b: any) => b.total - a.total)
}