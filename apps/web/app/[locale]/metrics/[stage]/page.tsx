import { Suspense } from 'react'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MetricsChart, StatsGrid, PageLoading } from '@elevate/ui/blocks'

import { getServerApiClient } from '../../../../lib/api-client'

import type { Metadata } from 'next'

interface MetricsPageProps {
  params: Promise<{
    locale: string
    stage: string
  }>
}

interface StageMetrics {
  stage: string
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgPointsEarned: number
  uniqueEducators: number
  topSchools: Array<{
    name: string
    count: number
  }>
  cohortBreakdown: Array<{
    cohort: string
    count: number
  }>
  monthlyTrend: Array<{
    month: string
    submissions: number
    approvals: number
  }>
  completionRate: number
}

const validStages = ['learn', 'explore', 'amplify', 'present', 'shine'] as const

type ValidStage = (typeof validStages)[number]

function isValidStage(stage: string): stage is ValidStage {
  return validStages.includes(stage as ValidStage)
}

const stageInfo = {
  learn: {
    title: 'Learn',
    description: 'Complete AI education courses and earn certificates',
    icon: '📚',
    points: 20,
  },
  explore: {
    title: 'Explore',
    description: 'Apply AI tools in classroom with evidence submission',
    icon: '🔍',
    points: 50,
  },
  amplify: {
    title: 'Amplify',
    description: 'Train peers and students in AI implementation',
    icon: '📢',
    points: 'Variable',
  },
  present: {
    title: 'Present',
    description: 'Share success stories on LinkedIn with evidence',
    icon: '📱',
    points: 20,
  },
  shine: {
    title: 'Shine',
    description: 'Submit innovative ideas for recognition and awards',
    icon: '✨',
    points: 'Recognition',
  },
}

async function fetchStageMetrics(stage: string): Promise<StageMetrics | null> {
  try {
    if (!isValidStage(stage)) return null
    const api = await getServerApiClient()
    const res = await api.getMetricsDTO({ stage })
    return res.data as unknown as StageMetrics
  } catch (_) {
    return null
  }
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

async function MetricsContent({
  stage,
  locale,
}: {
  stage: string
  locale: string
}) {
  if (!isValidStage(stage)) {
    notFound()
  }

  const metrics = await fetchStageMetrics(stage)
  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white border rounded-lg p-8 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Unable to load metrics right now
            </h2>
            <p className="text-gray-600 mb-6">
              Please try again in a moment. If the problem persists, contact
              support.
            </p>
            <div className="flex justify-center">
              <Link
                href={`/${locale}`}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Now stage is typed as ValidStage after the type guard
  const info = stageInfo[stage]
  const approvalRate = safeRate(
    metrics.approvedSubmissions,
    metrics.totalSubmissions,
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="text-4xl">{info.icon}</div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {info.title} Metrics
              </h1>
              <p className="text-lg text-gray-600">{info.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {validStages.map((s) => (
              <Link
                key={s}
                href={`/${locale}/metrics/${s}`}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  s === stage
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {stageInfo[s].title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Key Statistics */}
        <StatsGrid
          stats={[
            {
              label: 'Total Submissions',
              value: metrics.totalSubmissions,
              icon: '📝',
              color: 'text-blue-600',
            },
            {
              label: 'Approved',
              value: metrics.approvedSubmissions,
              change: approvalRate > 85 ? 15 : approvalRate > 70 ? 5 : -2,
              icon: '✅',
              color: 'text-green-600',
            },
            {
              label: 'Unique Educators',
              value: metrics.uniqueEducators,
              icon: '👥',
              color: 'text-purple-600',
            },
            {
              label: 'Avg Points',
              value: metrics.avgPointsEarned.toFixed(1),
              icon: '🏆',
              color: 'text-orange-600',
            },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submission Status */}
          <MetricsChart
            title="Submission Status"
            type="donut"
            data={[
              {
                label: 'Approved',
                value: metrics.approvedSubmissions,
                color: '#10b981',
              },
              {
                label: 'Pending',
                value: metrics.pendingSubmissions,
                color: '#f59e0b',
              },
              {
                label: 'Rejected',
                value: metrics.rejectedSubmissions,
                color: '#ef4444',
              },
            ]}
          />

          {/* Top Performing Schools */}
          <MetricsChart
            title="Top Performing Schools"
            type="bar"
            data={metrics.topSchools.map((school, index) => ({
              label: school.name.replace(/^SMA Negeri \d+ /, ''),
              value: school.count,
              color: `hsl(${220 + index * 20}, 70%, 50%)`,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cohort Breakdown */}
          <MetricsChart
            title="Participation by Cohort"
            type="bar"
            data={metrics.cohortBreakdown.map((cohort, index) => ({
              label: cohort.cohort,
              value: cohort.count,
              color: `hsl(${150 + index * 30}, 60%, 50%)`,
            }))}
          />

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Progress
            </h3>
            <div className="space-y-4">
              {metrics.monthlyTrend.map((month) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {month.month}
                    </span>
                    <span className="text-sm text-gray-600">
                      {month.submissions} submissions (
                      {Math.round((month.approvals / month.submissions) * 100)}%
                      approved)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 bg-blue-500 rounded-full"
                      style={{
                        width: `${
                          (month.submissions /
                            Math.max(
                              ...metrics.monthlyTrend.map((m) => m.submissions),
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Completion Analysis */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Performance Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {metrics.completionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                Approved / Total Submissions
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {safeRate(
                  metrics.approvedSubmissions,
                  metrics.uniqueEducators,
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-gray-600">Participation Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                Approved / Unique Educators
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {safeRate(
                  metrics.pendingSubmissions,
                  metrics.totalSubmissions,
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-gray-600">Under Review</div>
              <div className="text-xs text-gray-500 mt-1">
                Pending / Total Submissions
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-2">
            Ready to Join {info.title}?
          </h3>
          <p className="text-blue-100 mb-6">
            Join {metrics.uniqueEducators.toLocaleString()} educators who have
            already completed this stage
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/dashboard`}
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Start Your Journey
            </Link>
            <Link
              href={`/${locale}/leaderboard`}
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white hover:text-blue-600 transition-colors"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({
  params,
}: MetricsPageProps): Promise<Metadata> {
  const { stage } = await params
  const stageKey = stage.toLowerCase()

  if (!isValidStage(stageKey)) {
    return {
      title: 'Stage Not Found - MS Elevate LEAPS Tracker',
      description: 'The requested LEAPS stage could not be found.',
    }
  }

  // Now stageKey is typed as ValidStage after the type guard
  const info = stageInfo[stageKey]

  return {
    title: `${info.title} Metrics - MS Elevate LEAPS Tracker`,
    description: `View aggregate statistics and metrics for the ${info.title} stage of the LEAPS framework. ${info.description}`,
    openGraph: {
      title: `${info.title} Stage Metrics`,
      description: `Explore ${info.title} stage statistics in the MS Elevate LEAPS program. ${info.description}`,
      url: `https://leaps.mereka.org/metrics/${stageKey}`,
    },
  }
}

export default async function MetricsStagePage({ params }: MetricsPageProps) {
  const { stage, locale } = await params
  const stageKey = stage.toLowerCase()

  return (
    <Suspense fallback={<PageLoading />}>
      <MetricsContent stage={stageKey} locale={locale} />
    </Suspense>
  )
}
