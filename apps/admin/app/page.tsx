'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@elevate/ui'
import { StatusBadge } from '../components/ui/StatusBadge'

interface AnalyticsData {
  overview: {
    submissions: {
      total: number
      pending: number
      approved: number
      rejected: number
      approvalRate: number
    }
    users: {
      total: number
      active: number
      withSubmissions: number
      withBadges: number
      activationRate: number
    }
    points: {
      totalAwarded: number
      totalEntries: number
      avgPerEntry: number
    }
    badges: {
      totalBadges: number
      totalEarned: number
      uniqueEarners: number
    }
    reviews: {
      pendingReviews: number
      avgReviewTimeHours: number
    }
  }
  distributions: {
    submissionsByStatus: Array<{ status: string; count: number }>
    submissionsByActivity: Array<{ 
      activity: string
      activityName: string
      count: number 
    }>
    usersByRole: Array<{ role: string; count: number }>
    pointsByActivity: Array<{
      activity: string
      activityName: string
      totalPoints: number
      entries: number
    }>
  }
  recentActivity: {
    submissions: Array<{
      id: string
      user: { name: string; handle: string }
      activity: { name: string }
      status: string
      created_at: string
    }>
    approvals: Array<{
      id: string
      user: { name: string; handle: string }
      activity: { name: string }
      updated_at: string
    }>
    users: Array<{
      id: string
      name: string
      handle: string
      email: string
      role: string
      created_at: string
    }>
  }
  performance: {
    reviewers: Array<{
      id: string
      name: string
      handle: string
      role: string
      approved: number
      rejected: number
      total: number
    }>
  }
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    cohort: 'ALL'
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)
      if (dateRange.cohort !== 'ALL') params.set('cohort', dateRange.cohort)

      const response = await fetch(`/api/admin/analytics?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setAnalytics(data)
      } else {
        console.error('Failed to fetch analytics:', data.error)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
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
          <Button 
            variant="ghost" 
            onClick={fetchAnalytics}
            style={{ marginTop: '16px' }}
          >
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateRange.cohort}
              onChange={(e) => setDateRange(prev => ({ ...prev, cohort: e.target.value }))}
            >
              <option value="ALL">All Cohorts</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchAnalytics} style={{ width: '100%' }}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
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
            <p className="text-sm text-gray-600">
              {analytics.overview.users.active} active ({analytics.overview.users.activationRate}%)
            </p>
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
            <p className="text-sm text-gray-600">
              Avg {analytics.overview.points.avgPerEntry} per entry
            </p>
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
            <p className="text-sm text-gray-600">
              Avg {analytics.overview.reviews.avgReviewTimeHours.toFixed(1)}h review time
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submissions by Activity */}
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

        {/* Users by Role */}
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

        {/* Recent Submissions */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Submissions</h2>
            <Link href="/admin/submissions">
              <Button variant="ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.submissions.slice(0, 5).map((submission) => (
              <div key={submission.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{submission.user.name}</p>
                  <p className="text-xs text-gray-500">{submission.activity.name}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={submission.status} size="sm" />
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(submission.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviewer Performance */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Reviewer Performance</h2>
          <div className="space-y-3">
            {analytics.performance.reviewers.slice(0, 5).map((reviewer) => (
              <div key={reviewer.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-sm">{reviewer.name}</p>
                  <StatusBadge status={reviewer.role} size="sm" />
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{reviewer.total} reviews</p>
                  <p className="text-xs text-gray-500">
                    {reviewer.approved} approved, {reviewer.rejected} rejected
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
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
