import { parseActivityCode, type ActivityCode, type TopBadge } from '@elevate/types'


export type DailySubmission = { created_at: Date; status: string }

export function buildActivityNameMap(
  activities: Array<{ code: string; name: string }>
): Record<string, string> {
  return activities.reduce<Record<string, string>>((acc, a) => {
    acc[a.code] = a.name
    return acc
  }, {})
}

export function mapActivityDistribution(
  result: Array<{ activity_code: string; _count: number }>,
  activityMap: Record<string, string>
): Array<{ activity: ActivityCode | string; activityName: string; count: number }> {
  return result.map((item) => {
    const activity = parseActivityCode(item.activity_code)
    return {
      activity: activity ?? item.activity_code,
      activityName: activityMap[item.activity_code] || 'Unknown',
      count: item._count,
    }
  })
}

export function mapPointsByActivityDistribution(
  result: Array<{ activity_code: string; _sum: { delta_points: number | null }; _count: number }>,
  activityMap: Record<string, string>
): Array<{ activity: ActivityCode | string; activityName: string; totalPoints: number; entries: number }> {
  return result.map((item) => {
    const activity = parseActivityCode(item.activity_code)
    return {
      activity: activity ?? item.activity_code,
      activityName: activityMap[item.activity_code] || 'Unknown',
      totalPoints: item._sum.delta_points || 0,
      entries: item._count,
    }
  })
}

export function computeDailySubmissionStats(
  submissions: DailySubmission[]
): Array<{ date: string; total: number; approved: number; rejected: number; pending: number }> {
  const dailyStats = submissions.reduce(
    (acc, sub) => {
      const date = sub.created_at.toISOString().split('T')[0]
      if (!date) return acc
      if (!acc[date]) {
        acc[date] = { total: 0, approved: 0, rejected: 0, pending: 0 }
      }
      acc[date].total++
      const status = sub.status.toLowerCase()
      if (status === 'approved' || status === 'rejected' || status === 'pending') {
        acc[date][status]++
      }
      return acc
    },
    {} as Record<string, { total: number; approved: number; rejected: number; pending: number }>
  )

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function mapPointsDistributionFromUserTotals(totals: number[]): {
  totalUsers: number
  max: number
  min: number
  avg: number
  percentiles: Array<{ percentile: number; value: number }>
} {
  const sorted = totals.sort((a, b) => b - a)
  const percentiles = [10, 25, 50, 75, 90, 95, 99].map((p) => {
    const index = Math.floor((p / 100) * (sorted.length - 1))
    return { percentile: p, value: sorted[index] || 0 }
  })
  return {
    totalUsers: sorted.length,
    max: sorted[0] || 0,
    min: sorted[sorted.length - 1] || 0,
    avg: sorted.length > 0 ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 100) / 100 : 0,
    percentiles,
  }
}

export type Reviewer = { id: string; name: string; handle: string; role: string }
export type GroupByPerformanceRow = { reviewer_id: string | null; status: string; _count: number }

export function mapReviewerPerformance(
  reviewers: Reviewer[],
  performance: GroupByPerformanceRow[]
): Array<{
  id: string
  name: string
  handle: string
  role: string
  approved: number
  rejected: number
  total: number
}> {
  const reviewerMap = reviewers.reduce<Record<string, {
    id: string
    name: string
    handle: string
    role: string
    approved: number
    rejected: number
    total: number
  }>>((acc, r) => {
    acc[r.id] = { ...r, approved: 0, rejected: 0, total: 0 }
    return acc
  }, {})
  performance.forEach((p) => {
    if (!p.reviewer_id) return
    const r = reviewerMap[p.reviewer_id]
    if (!r) return
    const status = p.status.toLowerCase()
    if (status === 'approved' || status === 'rejected') {
      r[status] = p._count
      r.total += p._count
    }
  })
  return Object.values(reviewerMap)
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function mapTopBadges(
  result: Array<{ badge_code: string; _count: number }>,
  badges: Array<{ code: string; name: string; description: string; criteria: unknown; icon_url: string | null }>
): TopBadge[] {
  const badgeMap = badges.reduce<Record<string, typeof badges[number]>>((acc, b) => {
    acc[b.code] = b
    return acc
  }, {})
  return result
    .map((item) => {
      const b = badgeMap[item.badge_code]
      if (!b) return null
      return {
        badge: {
          code: b.code,
          name: b.name,
          description: b.description,
          criteria: b.criteria,
          icon_url: b.icon_url || undefined,
        },
        earnedCount: item._count,
      } as TopBadge
    })
    .filter((x): x is TopBadge => x !== null)
}
