"use server"
import 'server-only'

import { toRecentSubmission, toRecentApproval, toRecentUser } from '@/lib/server/mappers'
import { prisma } from '@elevate/db'
import {
  computeApprovalRate,
  computeActivationRate,
  buildActivityNameMap,
  mapActivityDistribution,
  computeDailySubmissionStats,
  mapPointsByActivityDistribution,
  mapTopBadges,
  mapReviewerPerformance,
} from '@elevate/logic'
// Note: parse helpers are used in mappers
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
  DailySubmissionStats,
  DailyRegistrationStats,
} from '@elevate/types/common'

export type AnalyticsQuery = { startDate?: string; endDate?: string; cohort?: string }

async function getSubmissionStats(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<SubmissionStats> {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.submission.count({ where: filter }),
    prisma.submission.count({ where: { ...filter, status: 'PENDING' } }),
    prisma.submission.count({ where: { ...filter, status: 'APPROVED' } }),
    prisma.submission.count({ where: { ...filter, status: 'REJECTED' } }),
  ])
  const approvalRate = computeApprovalRate(approved, rejected)
  return { total, pending, approved, rejected, approvalRate: Math.round(approvalRate * 100) / 100 }
}

async function getSubmissionsByStatus(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<StatusDistribution[]> {
  const result = await prisma.submission.groupBy({ by: ['status'], where: filter, _count: true })
  return result.map((item) => ({ status: item.status, count: item._count }))
}

async function getSubmissionsByActivity(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<ActivityDistribution[]> {
  const result = await prisma.submission.groupBy({ by: ['activity_code'], where: filter, _count: true, orderBy: { _count: { activity_code: 'desc' } } })
  const activities = await prisma.activity.findMany({ where: { code: { in: result.map((r) => r.activity_code) } } })
  const activityMap = buildActivityNameMap(activities)
  return mapActivityDistribution(result, activityMap) as ActivityDistribution[]
}

async function getSubmissionsByDate(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<DailySubmissionStats[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateFilter = { ...filter, created_at: { gte: thirtyDaysAgo, ...filter.created_at } }
  const submissions = await prisma.submission.findMany({ where: dateFilter, select: { created_at: true, status: true } })
  return computeDailySubmissionStats(submissions)
}

async function getUserStats(filter: { cohort?: string }): Promise<UserAnalyticsStats> {
  const [total, active, withSubmissions, withBadges] = await Promise.all([
    prisma.user.count({ where: filter }),
    prisma.user.count({ where: { ...filter, submissions: { some: {} } } }),
    prisma.user.count({ where: { ...filter, submissions: { some: { status: 'APPROVED' } } } }),
    prisma.user.count({ where: { ...filter, earned_badges: { some: {} } } }),
  ])
  const activationRate = computeActivationRate(active, total)
  return { total, active, withSubmissions, withBadges, activationRate: Math.round(activationRate * 100) / 100 }
}

async function getUsersByRole(filter: { cohort?: string }): Promise<RoleDistribution[]> {
  const result = await prisma.user.groupBy({ by: ['role'], where: filter, _count: true })
  return result.map((item) => ({ role: item.role, count: item._count }))
}

async function getUsersByCohort(): Promise<CohortDistribution[]> {
  const result = await prisma.user.groupBy({ by: ['cohort'], _count: true })
  return result.map((item) => ({ cohort: item.cohort ?? 'Unknown', count: item._count }))
}

async function getUserRegistrationsByDate(filter: { cohort?: string }): Promise<DailyRegistrationStats[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const users = await prisma.user.findMany({ where: { ...filter, created_at: { gte: thirtyDaysAgo } }, select: { created_at: true } })
  const counts = new Map<string, number>()
  for (const u of users) {
    const d = new Date(u.created_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
}

async function getPointsStats(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<PointsStats> {
  const totals = await prisma.pointsLedger.groupBy({ by: ['activity_code'], where: { ...(filter.user ? { user: filter.user } : {}), ...(filter.created_at ? { event_time: filter.created_at } : {}) }, _sum: { delta_points: true }, _count: true })
  const totalPoints = totals.reduce((acc, r) => acc + (r._sum.delta_points ?? 0), 0)
  return { totalAwarded: totalPoints, totalEntries: totals.reduce((a, r) => a + r._count, 0), avgPerEntry: totals.length ? Math.round((totalPoints / totals.length) * 100) / 100 : 0 }
}

async function getPointsByActivity(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<PointsActivityDistribution[]> {
  const totals = await prisma.pointsLedger.groupBy({ by: ['activity_code'], where: { ...(filter.user ? { user: filter.user } : {}), ...(filter.created_at ? { event_time: filter.created_at } : {}) }, _sum: { delta_points: true }, _count: true, orderBy: { _sum: { delta_points: 'desc' } } })
  const activities = await prisma.activity.findMany({ where: { code: { in: totals.map((r) => r.activity_code) } } })
  const activityMap = buildActivityNameMap(activities)
  return mapPointsByActivityDistribution(totals, activityMap) as PointsActivityDistribution[]
}

async function getPointsDistribution(filter: { user?: { cohort: string } }): Promise<Array<{ range: string; count: number }>> {
  const totals = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    where: { ...(filter.user ? { user: filter.user } : {}) },
    _sum: { delta_points: true },
  })

  const values = totals.map((t) => t._sum?.delta_points ?? 0)
  if (values.length === 0) return []

  // Optional quantile-based distribution via env ANALYTICS_POINTS_QUANTILES
  const quantilesEnv = process.env.ANALYTICS_POINTS_QUANTILES
  const quantiles = quantilesEnv ? Number.parseInt(quantilesEnv, 10) : NaN
  if (Number.isFinite(quantiles) && quantiles >= 2 && quantiles <= 10) {
    const sorted = [...values].sort((a, b) => a - b)
    const bins: Array<{ label: string; upper: number | null; count: number }> = []
    for (let i = 1; i <= quantiles; i += 1) {
      const idx = i === quantiles ? sorted.length - 1 : Math.max(0, Math.ceil((sorted.length * i) / quantiles) - 1)
      const upper = i === quantiles ? null : sorted[idx]
      bins.push({ label: `Q${i}${upper === null ? ' (+)' : ` (≤ ${upper})`}`, upper, count: 0 })
    }
    for (const v of sorted) {
      const binIndex = bins.findIndex((b) => b.upper !== null && v <= (b.upper as number))
      const idx = binIndex === -1 ? bins.length - 1 : binIndex
      const target = bins[idx]
      if (target) target.count += 1
    }
    return bins.map((b) => ({ range: b.label, count: b.count }))
  }

  // Bucket-based distribution via env ANALYTICS_POINTS_BUCKETS, e.g. "0,50,100,200,500"
  const bucketEnv = process.env.ANALYTICS_POINTS_BUCKETS
  const parsed = (bucketEnv || '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)

  const thresholds = parsed.length >= 2 ? parsed : [0, 50, 100, 200, 500]

  type Bucket = { min: number; max: number | null; label: string; count: number }
  const buckets: Bucket[] = []
  for (let i = 0; i < thresholds.length; i += 1) {
    const min = thresholds[i] as number
    const next = thresholds[i + 1]
    if (next !== undefined) {
      const max = next - 1
      buckets.push({ min, max, label: `${min}-${max}`, count: 0 })
    } else {
      buckets.push({ min, max: null, label: `${min}+`, count: 0 })
    }
  }

  for (const pts of values) {
    const idx = buckets.findIndex((b) => (b.max === null ? pts >= b.min : pts >= b.min && pts <= (b.max as number)))
    const index = idx === -1 ? buckets.length - 1 : idx
    const target = buckets[index]
    if (target) target.count += 1
  }

  return buckets.map((b) => ({ range: b.label, count: b.count }))
}

async function getRecentSubmissions(limit: number) {
  const rows = await prisma.submission.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { id: true, activity_code: true, created_at: true, status: true, user: { select: { name: true } } },
  })
  return rows.map((r) => toRecentSubmission({ id: r.id, activity_code: r.activity_code, created_at: r.created_at, status: r.status, user: r.user }))
}

async function getRecentApprovals(limit: number) {
  const rows = await prisma.submission.findMany({
    where: { status: 'APPROVED' },
    orderBy: { updated_at: 'desc' },
    take: limit,
    select: {
      id: true,
      activity_code: true,
      updated_at: true,
      reviewer: { select: { name: true } },
      user: { select: { name: true } },
      activity: { select: { default_points: true } },
    },
  })
  return rows.map((r) =>
    toRecentApproval({
      id: r.id,
      activity_code: r.activity_code,
      updated_at: r.updated_at ?? null,
      points_awarded: r.activity?.default_points ?? 0,
      reviewer: r.reviewer ?? null,
      user: r.user ?? null,
    }),
  )
}

async function getRecentUsers(limit: number) {
  const rows = await prisma.user.findMany({ orderBy: { created_at: 'desc' }, take: limit, select: { id: true, name: true, created_at: true, cohort: true } })
  return rows.map((r) => toRecentUser({ id: r.id, name: r.name, created_at: r.created_at, cohort: r.cohort ?? null }))
}

async function getBadgeStats(): Promise<BadgeStats> {
  const [totalBadges, totalEarned, uniqueEarners] = await Promise.all([
    prisma.badge.count(),
    prisma.earnedBadge.count(),
    prisma.earnedBadge.groupBy({ by: ['user_id'], _count: true }).then((result) => result.length),
  ])
  return { totalBadges, totalEarned, uniqueEarners }
}

async function getTopBadges(limit: number) {
  const result = await prisma.earnedBadge.groupBy({ by: ['badge_code'], _count: true, orderBy: { _count: { badge_code: 'desc' } }, take: limit })
  const badges = await prisma.badge.findMany({ where: { code: { in: result.map((r) => r.badge_code) } } })
  const mapped = mapTopBadges(result, badges)
  return mapped.map((tb) => ({ code: tb.badge.code, name: tb.badge.name, earnedCount: tb.earnedCount, uniqueEarners: 0 }))
}

async function getReviewStats(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<ReviewStats> {
  const [pending, avgReviewTime] = await Promise.all([
    prisma.submission.count({ where: { ...filter, status: 'PENDING' } }),
    getAverageReviewTime(filter),
  ])
  return { pendingReviews: pending, avgReviewTimeHours: avgReviewTime }
}

async function getAverageReviewTime(filter: { created_at?: { gte: Date; lte: Date }; user?: { cohort: string } }): Promise<number> {
  const reviewedSubmissions = await prisma.submission.findMany({ where: { ...filter, status: { in: ['APPROVED', 'REJECTED'] }, reviewer_id: { not: null } }, select: { created_at: true, updated_at: true } })
  if (reviewedSubmissions.length === 0) return 0
  const totalHours = reviewedSubmissions.reduce((sum, sub) => sum + (sub.updated_at.getTime() - sub.created_at.getTime()) / (1000 * 60 * 60), 0)
  return Math.round((totalHours / reviewedSubmissions.length) * 100) / 100
}

async function getReviewerPerformance() {
  const reviewers = await prisma.user.findMany({ where: { role: { in: ['REVIEWER', 'ADMIN', 'SUPERADMIN'] } }, select: { id: true, name: true, handle: true, role: true } })
  const reviewerIds = reviewers.map((r) => r.id)
  const performance = await prisma.submission.groupBy({ by: ['reviewer_id', 'status'], where: { reviewer_id: { in: reviewerIds }, status: { in: ['APPROVED', 'REJECTED'] } }, _count: true })
  const perf = mapReviewerPerformance(reviewers, performance)
  return perf.map((p) => ({ id: p.id, name: p.name, reviewCount: p.total, avgReviewTimeHours: 0, approvalRate: p.total ? Math.round((p.approved / p.total) * 100) / 100 : 0 }))
}

export async function getAnalyticsService(query: AnalyticsQuery) {
  const { startDate, endDate, cohort } = query
  const dateFilter: { created_at?: { gte: Date; lte: Date } } = {}
  if (startDate && endDate) {
    dateFilter.created_at = { gte: new Date(startDate), lte: new Date(endDate) }
  }
  const cohortFilter: { user?: { cohort: string } } = {}
  if (cohort && cohort !== 'ALL') cohortFilter.user = { cohort }

  const submissionFilter = { ...dateFilter, ...cohortFilter }
  const userFilter = cohort && cohort !== 'ALL' ? { cohort } : {}

  const [submissionStats, submissionsByStatus, submissionsByActivity, submissionsByDate, userStats, usersByRole, usersByCohort, userRegistrationsByDate, pointsStats, pointsByActivity, pointsDistribution, recentSubmissions, recentApprovals, recentUsers, badgeStats, topBadges, reviewStats, reviewerPerformance] = await Promise.all([
    getSubmissionStats(submissionFilter),
    getSubmissionsByStatus(submissionFilter),
    getSubmissionsByActivity(submissionFilter),
    getSubmissionsByDate(submissionFilter),

    getUserStats(userFilter),
    getUsersByRole(userFilter),
    getUsersByCohort(),
    getUserRegistrationsByDate(userFilter),

    getPointsStats(submissionFilter),
    getPointsByActivity(submissionFilter),
    getPointsDistribution(cohortFilter),

    getRecentSubmissions(10),
    getRecentApprovals(10),
    getRecentUsers(10),

    getBadgeStats(),
    getTopBadges(10),

    getReviewStats(submissionFilter),
    getReviewerPerformance(),
  ])

  const result = {
    overview: { submissions: submissionStats, users: userStats, points: pointsStats, badges: badgeStats, reviews: reviewStats },
    distributions: { submissionsByStatus, submissionsByActivity, usersByRole, usersByCohort, pointsByActivity, pointsDistribution },
    trends: { submissionsByDate, userRegistrationsByDate },
    recentActivity: { submissions: recentSubmissions, approvals: recentApprovals, users: recentUsers },
    performance: { reviewers: reviewerPerformance, topBadges },
  }
  const { AnalyticsResponseSchema } = await import('@elevate/types/admin-api-types')
  const envelope = { success: true as const, data: result }
  const parsed = AnalyticsResponseSchema.safeParse(envelope)
  if (!parsed.success) throw new Error('Invalid analytics response shape')
  return result
}
