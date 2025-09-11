'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useAuth } from '@clerk/nextjs'

import { getProfilePath, type SafeDashboardData } from '@elevate/types'
import { Button, Card, Alert, AlertTitle, AlertDescription } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'
import { useCurrentLocale } from '@elevate/ui/next'

// Use public API for client-side fetch

// Using SafeDashboardData from @elevate/types for better type safety
type DashboardData = SafeDashboardData

const ACTIVITY_ROUTES = {
  // LEARN points come from Kajabi tags (Option B).
  // Route to metrics instead of a form.
  LEARN: '/metrics/learn',
  EXPLORE: '/dashboard/explore',
  AMPLIFY: '/dashboard/amplify',
  PRESENT: '/dashboard/present',
  SHINE: '/dashboard/shine',
} as const

type ActivityCode = keyof typeof ACTIVITY_ROUTES

function isActivityCode(code: string): code is ActivityCode {
  return code in ACTIVITY_ROUTES
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
} as const

type StatusColor = keyof typeof STATUS_COLORS

function isStatusColor(status: string): status is StatusColor {
  return status in STATUS_COLORS
}

export default function DashboardPage() {
  const { isLoaded, userId } = useAuth()
  const { locale: _currentLocale, withLocale } = useCurrentLocale()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const didFetch = useRef(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const body = (await res.json()) as { data?: DashboardData }
      const result = { data: body.data as DashboardData }
      // Post sign-in role check: redirect to onboarding if not confirmed
      try {
        const meRes = await fetch('/api/profile/me')
        if (meRes.ok) {
          const me = (await meRes.json()) as { data?: { userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean } }
          // Always send Students to the info page, even if unconfirmed
          if (me?.data?.userType === 'STUDENT') {
            router.push(withLocale('/educators-only'))
            return
          }
          // Educators without confirmation go to onboarding
          if (me?.data?.userTypeConfirmed === false) {
            router.push(withLocale('/onboarding/user-type'))
            return
          }
        }
      } catch { /* noop */ }
      setData(result.data)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load dashboard'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [router, withLocale])

  useEffect(() => {
    if (!didFetch.current && isLoaded && userId) {
      didFetch.current = true
      void fetchDashboardData()
    }
  }, [isLoaded, userId, fetchDashboardData])

  if (!isLoaded || loading) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTitle>Error Loading Dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => void fetchDashboardData()}>Retry</Button>
          </div>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <div className="max-w-4xl mx-auto">
          <Alert variant="default">
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>No dashboard data available.</AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {data.user.name}!
          </h1>
          <p className="text-gray-600">
            Track your LEAPS journey and continue your AI in education
            adventure.
          </p>
          {data.user.school && (
            <p className="text-sm text-gray-500 mt-1">
              {data.user.school} {data.user.cohort && `• ${data.user.cohort}`}
            </p>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {data.points.total}
              </div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {data.stats.completedStages}
              </div>
              <div className="text-sm text-gray-600">Completed Stages</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {data.badges.length}
              </div>
              <div className="text-sm text-gray-600">Badges Earned</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {data.stats.pendingSubmissions}
              </div>
              <div className="text-sm text-gray-600">Pending Reviews</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEAPS Progress */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  LEAPS Progress
                </h2>

                <div className="space-y-6">
                  {data.progress.map((stage, index) => (
                    <div key={stage.activityCode} className="relative">
                      <div className="flex items-start space-x-4">
                        {/* Stage Icon */}
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                            stage.hasCompleted
                              ? 'bg-green-500'
                              : stage.submissionCounts.pending > 0
                              ? 'bg-yellow-500'
                              : 'bg-gray-300'
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Stage Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {stage.activityName}
                              </h3>
                              <div className="text-sm text-gray-600 mt-1">
                                {stage.pointsEarned > 0 && (
                                  <span className="text-green-600 font-medium">
                                    {stage.pointsEarned} points earned
                                  </span>
                                )}
                                {stage.submissionCounts.pending > 0 && (
                                  <span className="text-yellow-600 font-medium">
                                    {stage.submissionCounts.pending} pending
                                    review
                                  </span>
                                )}
                                {!stage.hasCompleted &&
                                  stage.submissionCounts.pending === 0 && (
                                    <span className="text-gray-500">
                                      Up to {stage.defaultPoints} points
                                      available
                                    </span>
                                  )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              {stage.submissionCounts.total > 0 && (
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    stage.hasCompleted
                                      ? STATUS_COLORS.APPROVED
                                      : stage.submissionCounts.pending > 0
                                      ? STATUS_COLORS.PENDING
                                      : STATUS_COLORS.REJECTED
                                  }`}
                                >
                                  {stage.submissionCounts.approved} approved,{' '}
                                  {stage.submissionCounts.pending} pending
                                </span>
                              )}

                              <Link
                                href={withLocale(
                                  isActivityCode(stage.activityCode)
                                    ? ACTIVITY_ROUTES[stage.activityCode]
                                    : '/dashboard',
                                )}
                              >
                                <Button>
                                  {stage.hasCompleted ? 'View' : 'Start'}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Connection Line */}
                      {index < data.progress.length - 1 && (
                        <div className="absolute left-5 top-10 w-px h-6 bg-gray-300"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            {data.badges.length > 0 && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Badges
                  </h3>
                  <div className="space-y-3">
                    {data.badges.slice(0, 3).map((badge) => (
                      <div
                        key={badge.code}
                        className="flex items-center space-x-3"
                      >
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          {badge.icon_url ? (
                            <Image
                              src={badge.icon_url}
                              alt={badge.name}
                              width={20}
                              height={20}
                              className="w-5 h-5"
                            />
                          ) : (
                            <span className="text-purple-600 font-bold text-xs">
                              B
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {badge.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {badge.earned_at
                              ? new Date(badge.earned_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Recent Activity */}
            {data.recentActivity.length > 0 && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {data.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {activity.activityName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            isStatusColor(activity.status)
                              ? STATUS_COLORS[activity.status]
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {activity.status.toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <Link href={withLocale('/leaderboard')} className="block">
                    <Button className="w-full text-left justify-start">
                      View Leaderboard
                    </Button>
                  </Link>
                  <Link
                    href={`${withLocale('')}${getProfilePath(
                      data.user.handle,
                    )}`}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      View Public Profile
                    </Button>
                  </Link>
                  <Link href={withLocale('/account')} className="block">
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Manage Account
                    </Button>
                  </Link>
                  <Link
                    href={withLocale('/dashboard/explore')}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Start Explore
                    </Button>
                  </Link>
                  <Link
                    href={withLocale('/dashboard/amplify')}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Submit Amplify Evidence
                    </Button>
                  </Link>
                  <Link
                    href={withLocale('/dashboard/amplify/invite')}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Invite Peers/Students
                    </Button>
                  </Link>
                  <Link
                    href={withLocale('/dashboard/present')}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Submit LinkedIn Post
                    </Button>
                  </Link>
                  <Link href={withLocale('/dashboard/shine')} className="block">
                    <Button
                      variant="ghost"
                      className="w-full text-left justify-start"
                    >
                      Submit Innovation
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
