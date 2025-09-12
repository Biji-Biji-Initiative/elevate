"use client"

import React, { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'
import { buildQueryString } from '@/lib/utils/query'

import { useTranslations } from 'next-intl'
import { z } from 'zod'

import { getAnalyticsAction } from '@/lib/actions/analytics'
import { fetchReferralsSummaryAction } from '@/lib/actions/referrals'
import {
  OverviewStatsSchema,
  DistributionsSchema,
  TrendsSchema,
  RecentActivitySchema,
  PerformanceSchema,
  type AnalyticsQuery,
  type OverviewStats,
  type Distributions,
  type Trends,
  type RecentActivity,
  type Performance,
} from '@elevate/types/admin-api-types'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
} from '@elevate/ui'
import { StatusBadge } from '@elevate/ui/blocks'

type AnalyticsData = {
  overview: OverviewStats
  distributions: Distributions
  trends: Trends
  recentActivity: RecentActivity
  performance: Performance
}

const AnalyticsDataSchema = z.object({
  overview: OverviewStatsSchema,
  distributions: DistributionsSchema,
  trends: TrendsSchema,
  recentActivity: RecentActivitySchema,
  performance: PerformanceSchema,
})

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

type Props = {
  initialAnalytics: AnalyticsData | null
  initialCohorts: string[]
}

export default function ClientPage({ initialAnalytics, initialCohorts }: Props) {
  const tq = useTranslations('dashboard.quick')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(
    initialAnalytics,
  )
  const clerkDashboardBase = process.env.NEXT_PUBLIC_CLERK_DASHBOARD_URL || ''
  const [loading, setLoading] = useState(!initialAnalytics)
  const [cohorts] = useState<string[]>(initialCohorts)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    cohort: 'ALL',
  })
  const [referralsSummary, setReferralsSummary] = useState<null | { month: string; total: number; byType: { educators: number; students: number }; uniqueReferrers: number; pointsAwarded: number; topReferrers: Array<{ userId: string; points: number; user: { id: string; name: string; email: string; handle: string } }> }>(null)
  const [referralsTrend, setReferralsTrend] = useState<Array<{ month: string; total: number; points: number }>>([])
  const [recentLogs, setRecentLogs] = useState<Array<{ id: string; action: string; actor_id: string; target_id: string | null; created_at: string }>>([])

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const params: AnalyticsQuery = {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        cohort: dateRange.cohort !== 'ALL' ? dateRange.cohort : undefined,
      }
      const raw = await getAnalyticsAction(params)
      const parsed = AnalyticsDataSchema.safeParse(raw)
      setAnalytics(parsed.success ? (raw as AnalyticsData) : null)
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Analytics fetch: ${msg}`)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    if (!initialAnalytics) void fetchAnalytics()
  }, [initialAnalytics, fetchAnalytics])

  useEffect(() => {
    const load = async () => {
      try {
        const d = new Date()
        const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        const sum = await fetchReferralsSummaryAction(ym)
        setReferralsSummary(sum)
      } catch {
        void 0 // allow dashboard to render without referrals summary
      }
      // Load 6-month referrals trend (best-effort)
      try {
        const base = new Date()
        const months: string[] = []
        for (let i = 5; i >= 0; i--) {
          const dt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1))
          months.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
        }
        const results = await Promise.allSettled(months.map((m) => fetchReferralsSummaryAction(m)))
        const data = results.map((r, idx) => (
          r.status === 'fulfilled' && r.value
            ? { month: months[idx] ?? '', total: r.value.total || 0, points: r.value.pointsAwarded || 0 }
            : { month: months[idx] ?? '', total: 0, points: 0 }
        ))
        setReferralsTrend(data)
      } catch {
        // ignore trend failures
      }
      try {
        const res = await fetch('/api/admin/audit?limit=5')
        const json = await res.json().catch(() => ({})) as { data?: { logs?: Array<{ id: string; action: string; actor_id: string; target_id: string | null; created_at: string }> } }
        if (res.ok && json?.data?.logs) setRecentLogs(json.data.logs)
      } catch {
        void 0 // allow dashboard to render without recent audit logs
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {SKELETON_KEYS.map((k) => (
              <div key={`skeleton-${k}`} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load analytics data</p>
          <Button variant="ghost" onClick={fetchAnalytics} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Overview of the MS Elevate LEAPS program performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="./kajabi" className="block">
          <div className="p-4 rounded-lg border bg-white hover:shadow">
            <div className="text-sm text-gray-600">{tq('integration_label')}</div>
            <div className="text-lg font-semibold">{tq('integration')}</div>
            <div className="text-xs text-gray-500 mt-1">{tq('integration_desc')}</div>
          </div>
        </Link>
        <Link href="./storage" className="block">
          <div className="p-4 rounded-lg border bg-white hover:shadow">
            <div className="text-sm text-gray-600">{tq('storage_label')}</div>
            <div className="text-lg font-semibold">{tq('storage')}</div>
            <div className="text-xs text-gray-500 mt-1">{tq('storage_desc')}</div>
          </div>
        </Link>
        <Link href="./ops" className="block">
          <div className="p-4 rounded-lg border bg-white hover:shadow">
            <div className="text-sm text-gray-600">{tq('ops_label')}</div>
            <div className="text-lg font-semibold">{tq('ops')}</div>
            <div className="text-xs text-gray-500 mt-1">{tq('ops_desc')}</div>
          </div>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="analytics-start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              id="analytics-start-date"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="analytics-end-date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              id="analytics-end-date"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <span id="analytics-cohort-label" className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </span>
            <Select value={dateRange.cohort} onValueChange={(value) => setDateRange((prev) => ({ ...prev, cohort: value }))}>
              <SelectTrigger aria-labelledby="analytics-cohort-label">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cohorts</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchAnalytics} style={{ width: '100%' }}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.submissions.total}</p>
            </div>
            <div className="text-blue-600 text-2xl">📝</div>
          </div>
          <div className="mt-4">
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-yellow-600">⏳ {analytics.overview.submissions.pending} pending</span>
              <span className="text-green-600">✅ {analytics.overview.submissions.approved} approved</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.users.total}</p>
            </div>
            <div className="text-green-600 text-2xl">👥</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">{analytics.overview.users.active} active ({analytics.overview.users.activationRate}%)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Points Awarded</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.points.totalAwarded.toLocaleString()}</p>
            </div>
            <div className="text-purple-600 text-2xl">💯</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">Avg {analytics.overview.points.avgPerEntry} per entry</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.reviews.pendingReviews}</p>
            </div>
            <div className="text-orange-600 text-2xl">⏰</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">Avg {analytics.overview.reviews.avgReviewTimeHours.toFixed(1)}h review time</p>
          </div>
        </div>
      </div>
      {referralsSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Referrals ({referralsSummary.month})</p>
                <p className="text-2xl font-bold text-gray-900">{referralsSummary.total}</p>
              </div>
              <div className="text-indigo-600 text-2xl">🔗</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 rounded p-3"><div className="text-gray-500">Educator</div><div className="font-semibold">{referralsSummary.byType.educators}</div></div>
              <div className="bg-gray-50 rounded p-3"><div className="text-gray-500">Student</div><div className="font-semibold">{referralsSummary.byType.students}</div></div>
              <div className="bg-gray-50 rounded p-3"><div className="text-gray-500">Points</div><div className="font-semibold">{referralsSummary.pointsAwarded}</div></div>
            </div>
            <div className="mt-4">
              <Link href={`/admin/referrals?${buildQueryString({ month: referralsSummary.month })}`}>
                <Button variant="ghost" style={{ padding: '4px 8px', fontSize: 12 }}>View Referrals</Button>
              </Link>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg border md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Admin Activity</h2>
              <Link href="/admin/audit"><Button variant="ghost" style={{ padding: '4px 8px', fontSize: 12 }}>View All</Button></Link>
            </div>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{log.action}</p>
                    <p className="text-xs text-gray-500">actor: {log.actor_id} target: {log.target_id || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mt-1">{new Date(log.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && <p className="text-sm text-gray-500">No recent admin activity</p>}
            </div>
          </div>
          {referralsSummary.topReferrers.length > 0 && (
            <div className="bg-white p-6 rounded-lg border md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Top Referrers (Points)</h2>
                <Link href={`/admin/referrals?${buildQueryString({ month: referralsSummary.month })}`}>
                  <Button variant="ghost" style={{ padding: '4px 8px', fontSize: 12 }}>View All</Button>
                </Link>
              </div>
              <div className="space-y-3">
                {referralsSummary.topReferrers.map((t) => (
                  <div key={t.userId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{t.user.name || t.user.handle || t.userId}</p>
                      <p className="text-xs text-gray-500">{t.user.email}</p>
                    </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.points}</span>
                    <Link href={`/admin/referrals?${buildQueryString({ referrerId: t.userId, month: referralsSummary.month })}`}>
                      <Button variant="ghost" style={{ padding: '2px 6px', fontSize: 12 }}>View</Button>
                    </Link>
                    {clerkDashboardBase && (
                        <a
                          href={`${clerkDashboardBase.replace(/\/$/, '')}/users/${encodeURIComponent(t.userId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50"
                        >
                          Open in Clerk
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {referralsTrend.length > 0 && (
            <div className="bg-white p-6 rounded-lg border md:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Referrals Trend (6 months)</h2>
                <Link href={`/admin/referrals?${buildQueryString({ month: referralsSummary.month })}`}>
                  <Button variant="ghost" style={{ padding: '4px 8px', fontSize: 12 }}>Details</Button>
                </Link>
              </div>
              <div className="grid grid-cols-6 gap-3 items-end" style={{ minHeight: 120 }}>
                {referralsTrend.map((m) => (
                  <div key={m.month} className="flex flex-col items-center justify-end gap-2">
                    <div className="w-full bg-indigo-100 rounded" style={{ height: Math.max(6, Math.min(100, m.total)) }} />
                    <div className="text-xs text-gray-500">{m.month.slice(2)}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">Bar height proportional to total referrals each month</div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Referral Points (6 months)</h3>
                <div className="grid grid-cols-6 gap-3 items-end" style={{ minHeight: 60 }}>
                  {referralsTrend.map((m) => (
                    <div key={m.month + ':p'} className="flex flex-col items-center justify-end gap-1">
                      <div className="w-full bg-purple-100 rounded" style={{ height: Math.max(4, Math.min(60, m.points)) }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Submissions by Activity</h2>
          <div className="space-y-3">
            {analytics.distributions.submissionsByActivity.map((item) => (
              <div key={item.activity} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-sm">
                    {item.activity[0]}
                  </div>
                  <span className="font-medium">{item.activityName}</span>
                </div>
                <span className="font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Users by Role</h2>
          <div className="space-y-3">
            {analytics.distributions.usersByRole.map((item) => (
              <div key={item.role} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <StatusBadge status={item.role} size="sm" />
                </div>
                <span className="font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Submissions</h2>
            <Link href="/admin/submissions">
              <Button variant="ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.submissions.slice(0, 5).map((submission) => (
              <div key={submission.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{submission.user_name}</p>
                  <p className="text-xs text-gray-500">{submission.activity_code}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={submission.status} size="sm" />
                  <p className="text-xs text-gray-500 mt-1">{new Date(submission.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Reviewer Performance</h2>
          <div className="space-y-3">
            {analytics.performance.reviewers.slice(0, 5).map((reviewer) => (
              <div key={reviewer.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{reviewer.name}</p>
                  <p className="text-xs text-gray-500">Avg {reviewer.avgReviewTimeHours.toFixed(1)}h per review</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{reviewer.reviewCount} reviews</p>
                  <p className="text-xs text-gray-500">Approval rate {reviewer.approvalRate}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/submissions">
            <Button variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              📝 Review Queue ({analytics.overview.reviews.pendingReviews})
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              👥 Manage Users
            </Button>
          </Link>
          <Link href="/admin/badges">
            <Button variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              🏆 Badge Management
            </Button>
          </Link>
          <Link href="/admin/exports">
            <Button variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              📊 Export Data
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
