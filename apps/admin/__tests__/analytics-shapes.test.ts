import { describe, it, expect } from 'vitest'

import {
  DistributionsSchema,
  TrendsSchema,
  OverviewStatsSchema,
  RecentActivitySchema,
  PerformanceSchema,
} from '@elevate/types/admin-api-types'

describe('analytics DTO shapes', () => {
  it('validates distributions shape', () => {
    const sample = {
      submissionsByStatus: [
        { status: 'PENDING', count: 3 },
        { status: 'APPROVED', count: 5 },
      ],
      submissionsByActivity: [
        { activity: 'LEARN', activityName: 'Learn', count: 2 },
        { activity: 'BUILD', activityName: 'Build', count: 3 },
      ],
      usersByRole: [
        { role: 'PARTICIPANT', count: 10 },
        { role: 'REVIEWER', count: 2 },
      ],
      usersByCohort: [
        { cohort: 'C1', count: 6 },
        { cohort: null, count: 1 },
      ],
      pointsByActivity: [
        { activity: 'LEARN', activityName: 'Learn', totalPoints: 40, entries: 4 },
      ],
      pointsDistribution: [
        { range: '0-10', count: 3 },
      ],
    }
    const parsed = DistributionsSchema.safeParse(sample)
    expect(parsed.success).toBe(true)
  })

  it('validates trends shape', () => {
    const sample = {
      submissionsByDate: [
        { date: '2025-01-01', total: 4, approved: 2, rejected: 1, pending: 1 },
      ],
      userRegistrationsByDate: [{ date: '2025-01-01', count: 3 }],
    }
    const parsed = TrendsSchema.safeParse(sample)
    expect(parsed.success).toBe(true)
  })

  it('validates overview/recent/performance shapes for sanity', () => {
    const overview = {
      submissions: { total: 10, pending: 4, approved: 5, rejected: 1, approvalRate: 0.83 },
      users: { total: 100, active: 60, withSubmissions: 30, withBadges: 20, activationRate: 0.6 },
      points: { totalAwarded: 500, totalEntries: 120, avgPerEntry: 4.17 },
      badges: { totalBadges: 8, totalEarned: 20, uniqueEarners: 12 },
      reviews: { pendingReviews: 2, avgReviewTimeHours: 1.5 },
    }
    const overviewParsed = OverviewStatsSchema.safeParse(overview)
    expect(overviewParsed.success).toBe(true)

    const recent = {
      submissions: [
        { id: 's1', activity_code: 'LEARN', user_name: 'Alice', created_at: '2025-01-01T00:00:00.000Z', status: 'PENDING' },
      ],
      approvals: [
        { id: 's2', activity_code: 'BUILD', user_name: 'Bob', reviewer_name: 'R', approved_at: '2025-01-02T00:00:00.000Z', points_awarded: 10 },
      ],
      users: [{ id: 'u1', name: 'Alice', created_at: '2025-01-03T00:00:00.000Z', cohort: 'C1' }],
    }
    const recentParsed = RecentActivitySchema.safeParse(recent)
    expect(recentParsed.success).toBe(true)

    const perf = {
      reviewers: [
        { id: 'r1', name: 'R', reviewCount: 10, avgReviewTimeHours: 1.2, approvalRate: 0.8 },
      ],
      topBadges: [
        { code: 'EARLY', name: 'Early', earnedCount: 5, uniqueEarners: 3 },
      ],
    }
    const perfParsed = PerformanceSchema.safeParse(perf)
    expect(perfParsed.success).toBe(true)
  })

  it('accepts quantile-labeled pointsDistribution', () => {
    const sample = {
      submissionsByStatus: [],
      submissionsByActivity: [],
      usersByRole: [],
      usersByCohort: [],
      pointsByActivity: [],
      pointsDistribution: [
        { range: 'Q1 (≤ 10)', count: 5 },
        { range: 'Q2 (≤ 20)', count: 5 },
        { range: 'Q3 (+)', count: 2 },
      ],
    }
    const parsed = DistributionsSchema.safeParse(sample)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.pointsDistribution?.[0]?.range.startsWith('Q')).toBe(true)
  })
})
