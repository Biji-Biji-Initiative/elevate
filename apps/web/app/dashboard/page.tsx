'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { Button } from '@elevate/ui/Button'
import { Card } from '@elevate/ui/Card'
import { LoadingSpinner, Alert } from '@elevate/ui/FormField'

interface DashboardData {
  user: {
    id: string
    name: string
    handle: string
    school?: string
    cohort?: string
  }
  points: {
    total: number
    breakdown: Record<string, number>
  }
  progress: Array<{
    activityCode: string
    activityName: string
    defaultPoints: number
    pointsEarned: number
    submissionCounts: {
      total: number
      approved: number
      pending: number
      rejected: number
    }
    latestSubmission: any
    hasCompleted: boolean
  }>
  badges: Array<{
    code: string
    name: string
    description: string
    iconUrl?: string
    earnedAt: string
  }>
  recentActivity: Array<{
    id: string
    activityCode: string
    activityName: string
    status: string
    createdAt: string
    updatedAt: string
  }>
  stats: {
    totalSubmissions: number
    approvedSubmissions: number
    pendingSubmissions: number
    completedStages: number
  }
}

const ACTIVITY_ROUTES = {
  LEARN: '/dashboard/learn',
  EXPLORE: '/dashboard/explore',
  AMPLIFY: '/dashboard/amplify',
  PRESENT: '/dashboard/present',
  SHINE: '/dashboard/shine'
} as const

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800'
} as const

export default function DashboardPage() {
  const { isLoaded, userId } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && userId) {
      fetchDashboardData()
    }
  }, [isLoaded, userId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch dashboard data')
      }

      setData(result.data)
    } catch (error) {
      console.error('Dashboard fetch error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

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
          <Alert type="error" title="Error Loading Dashboard">
            {error}
          </Alert>
          <div className="mt-4">
            <Button onClick={fetchDashboardData}>Retry</Button>
          </div>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <div className="max-w-4xl mx-auto">
          <Alert type="info">
            No dashboard data available.
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
            Track your LEAPS journey and continue your AI in education adventure.
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
                <h2 className="text-xl font-semibold text-gray-900 mb-6">LEAPS Progress</h2>
                
                <div className="space-y-6">
                  {data.progress.map((stage, index) => (
                    <div key={stage.activityCode} className="relative">
                      <div className="flex items-start space-x-4">
                        {/* Stage Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          stage.hasCompleted 
                            ? 'bg-green-500' 
                            : stage.submissionCounts.pending > 0
                            ? 'bg-yellow-500'
                            : 'bg-gray-300'
                        }`}>
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
                                    {stage.submissionCounts.pending} pending review
                                  </span>
                                )}
                                {!stage.hasCompleted && stage.submissionCounts.pending === 0 && (
                                  <span className="text-gray-500">
                                    Up to {stage.defaultPoints} points available
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {stage.submissionCounts.total > 0 && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  stage.hasCompleted 
                                    ? STATUS_COLORS.APPROVED
                                    : stage.submissionCounts.pending > 0
                                    ? STATUS_COLORS.PENDING
                                    : STATUS_COLORS.REJECTED
                                }`}>
                                  {stage.submissionCounts.approved} approved, {stage.submissionCounts.pending} pending
                                </span>
                              )}
                              
                              <Link href={ACTIVITY_ROUTES[stage.activityCode as keyof typeof ACTIVITY_ROUTES]}>
                                <Button size="sm">
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Badges</h3>
                  <div className="space-y-3">
                    {data.badges.slice(0, 3).map((badge) => (
                      <div key={badge.code} className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          {badge.iconUrl ? (
                            <img src={badge.iconUrl} alt={badge.name} className="w-5 h-5" />
                          ) : (
                            <span className="text-purple-600 font-bold text-xs">B</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {badge.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(badge.earnedAt).toLocaleDateString()}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {data.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {activity.activityName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS]}`}>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Link href="/leaderboard" className="block">
                    <Button className="w-full text-left justify-start">
                      View Leaderboard
                    </Button>
                  </Link>
                  <Link href="/u/[handle]" as={`/u/${data.user.handle}`} className="block">
                    <Button variant="outline" className="w-full text-left justify-start">
                      View Public Profile
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