import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { MetricsChart, StatsGrid } from '../../../components/MetricsChart'
import { StageCard } from '../../../components/StageCard'
import { PageLoading } from '../../../components/LoadingSpinner'

interface MetricsPageProps {
  params: Promise<{
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

const validStages = ['learn', 'explore', 'amplify', 'present', 'shine']

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

// Mock data - in production this would come from the API
const mockMetrics: Record<string, StageMetrics> = {
  learn: {
    stage: 'learn',
    totalSubmissions: 1247,
    approvedSubmissions: 1124,
    pendingSubmissions: 89,
    rejectedSubmissions: 34,
    avgPointsEarned: 19.2,
    uniqueEducators: 1089,
    topSchools: [
      { name: 'SMA Negeri 1 Jakarta', count: 45 },
      { name: 'SMA Negeri 2 Surabaya', count: 38 },
      { name: 'SMA Negeri 1 Bandung', count: 32 },
      { name: 'SMA Negeri 3 Medan', count: 28 },
      { name: 'SMA Negeri 1 Yogyakarta', count: 24 },
    ],
    cohortBreakdown: [
      { cohort: 'Jakarta 2024', count: 312 },
      { cohort: 'Surabaya 2024', count: 198 },
      { cohort: 'Bandung 2024', count: 156 },
      { cohort: 'Medan 2024', count: 134 },
      { cohort: 'Other', count: 447 },
    ],
    monthlyTrend: [
      { month: 'Sep 2024', submissions: 145, approvals: 132 },
      { month: 'Oct 2024', submissions: 289, approvals: 261 },
      { month: 'Nov 2024', submissions: 356, approvals: 324 },
      { month: 'Dec 2024', submissions: 457, approvals: 407 },
    ],
    completionRate: 90.1
  },
  explore: {
    stage: 'explore',
    totalSubmissions: 892,
    approvedSubmissions: 743,
    pendingSubmissions: 112,
    rejectedSubmissions: 37,
    avgPointsEarned: 47.8,
    uniqueEducators: 743,
    topSchools: [
      { name: 'SMA Negeri 1 Jakarta', count: 34 },
      { name: 'SMA Negeri 2 Surabaya', count: 29 },
      { name: 'SMA Negeri 1 Bandung', count: 25 },
      { name: 'SMA Negeri 3 Medan', count: 21 },
      { name: 'SMA Negeri 1 Yogyakarta', count: 18 },
    ],
    cohortBreakdown: [
      { cohort: 'Jakarta 2024', count: 234 },
      { cohort: 'Surabaya 2024', count: 145 },
      { cohort: 'Bandung 2024', count: 123 },
      { cohort: 'Medan 2024', count: 98 },
      { cohort: 'Other', count: 292 },
    ],
    monthlyTrend: [
      { month: 'Sep 2024', submissions: 98, approvals: 82 },
      { month: 'Oct 2024', submissions: 187, approvals: 156 },
      { month: 'Nov 2024', submissions: 243, approvals: 203 },
      { month: 'Dec 2024', submissions: 364, approvals: 302 },
    ],
    completionRate: 83.3
  },
  // Similar data for other stages...
}

// Fill in other stages with scaled data
Object.keys(stageInfo).forEach(stage => {
  if (!mockMetrics[stage] && stage !== 'learn') {
    const baseMetrics = mockMetrics.learn
    const scaleFactor = stage === 'explore' ? 0.7 : stage === 'amplify' ? 0.5 : stage === 'present' ? 0.4 : 0.3
    
    mockMetrics[stage] = {
      ...baseMetrics,
      stage,
      totalSubmissions: Math.floor(baseMetrics.totalSubmissions * scaleFactor),
      approvedSubmissions: Math.floor(baseMetrics.approvedSubmissions * scaleFactor),
      pendingSubmissions: Math.floor(baseMetrics.pendingSubmissions * scaleFactor),
      rejectedSubmissions: Math.floor(baseMetrics.rejectedSubmissions * scaleFactor),
      uniqueEducators: Math.floor(baseMetrics.uniqueEducators * scaleFactor),
      topSchools: baseMetrics.topSchools.map(school => ({
        ...school,
        count: Math.floor(school.count * scaleFactor)
      })),
      cohortBreakdown: baseMetrics.cohortBreakdown.map(cohort => ({
        ...cohort,
        count: Math.floor(cohort.count * scaleFactor)
      })),
      monthlyTrend: baseMetrics.monthlyTrend.map(month => ({
        ...month,
        submissions: Math.floor(month.submissions * scaleFactor),
        approvals: Math.floor(month.approvals * scaleFactor)
      }))
    }
  }
})

async function fetchStageMetrics(stage: string): Promise<StageMetrics | null> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // In production, this would fetch from /api/metrics/${stage}
  return mockMetrics[stage] || null
}

async function MetricsContent({ stage }: { stage: string }) {
  if (!validStages.includes(stage)) {
    notFound()
  }
  
  const metrics = await fetchStageMetrics(stage)
  if (!metrics) {
    notFound()
  }
  
  const info = stageInfo[stage as keyof typeof stageInfo]
  const approvalRate = (metrics.approvedSubmissions / metrics.totalSubmissions) * 100

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="text-4xl">{info.icon}</div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{info.title} Metrics</h1>
              <p className="text-lg text-gray-600">{info.description}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {validStages.map((s) => (
              <Link
                key={s}
                href={`/metrics/${s}`}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  s === stage
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {stageInfo[s as keyof typeof stageInfo].title}
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
              color: 'text-blue-600'
            },
            {
              label: 'Approved',
              value: metrics.approvedSubmissions,
              change: approvalRate > 85 ? 15 : approvalRate > 70 ? 5 : -2,
              icon: '✅',
              color: 'text-green-600'
            },
            {
              label: 'Unique Educators',
              value: metrics.uniqueEducators,
              icon: '👥',
              color: 'text-purple-600'
            },
            {
              label: 'Avg Points',
              value: metrics.avgPointsEarned.toFixed(1),
              icon: '🏆',
              color: 'text-orange-600'
            }
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submission Status */}
          <MetricsChart
            title="Submission Status"
            type="donut"
            data={[
              { label: 'Approved', value: metrics.approvedSubmissions, color: '#10b981' },
              { label: 'Pending', value: metrics.pendingSubmissions, color: '#f59e0b' },
              { label: 'Rejected', value: metrics.rejectedSubmissions, color: '#ef4444' },
            ]}
          />

          {/* Top Performing Schools */}
          <MetricsChart
            title="Top Performing Schools"
            type="bar"
            data={metrics.topSchools.map((school, index) => ({
              label: school.name.replace(/^SMA Negeri \d+ /, ''),
              value: school.count,
              color: `hsl(${220 + index * 20}, 70%, 50%)`
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
              color: `hsl(${150 + index * 30}, 60%, 50%)`
            }))}
          />

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Progress</h3>
            <div className="space-y-4">
              {metrics.monthlyTrend.map((month, index) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{month.month}</span>
                    <span className="text-sm text-gray-600">
                      {month.submissions} submissions ({Math.round((month.approvals / month.submissions) * 100)}% approved)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 bg-blue-500 rounded-full"
                      style={{ width: `${(month.submissions / Math.max(...metrics.monthlyTrend.map(m => m.submissions))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Completion Analysis */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{metrics.completionRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                Approved / Total Submissions
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {((metrics.approvedSubmissions / metrics.uniqueEducators) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Participation Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                Approved / Unique Educators
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {(metrics.pendingSubmissions / metrics.totalSubmissions * 100).toFixed(1)}%
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
          <h3 className="text-2xl font-bold mb-2">Ready to Join {info.title}?</h3>
          <p className="text-blue-100 mb-6">
            Join {metrics.uniqueEducators.toLocaleString()} educators who have already completed this stage
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Start Your Journey
            </Link>
            <Link 
              href="/leaderboard"
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

export async function generateMetadata({ params }: MetricsPageProps): Promise<Metadata> {
  const { stage } = await params
  const stageKey = stage.toLowerCase()
  
  if (!validStages.includes(stageKey)) {
    return {
      title: 'Stage Not Found - MS Elevate LEAPS Tracker',
      description: 'The requested LEAPS stage could not be found.',
    }
  }
  
  const info = stageInfo[stageKey as keyof typeof stageInfo]
  
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
  const { stage } = await params
  const stageKey = stage.toLowerCase()
  
  return (
    <Suspense fallback={<PageLoading />}>
      <MetricsContent stage={stageKey} />
    </Suspense>
  )
}

