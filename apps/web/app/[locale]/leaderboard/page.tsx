'use client'

import { useState, useEffect , Suspense } from 'react'

import { z } from 'zod'
import { getProfilePath, type LeaderboardEntry } from '@elevate/types'
import { LeaderboardTable, PageLoading } from '@elevate/ui'
import { getApiClient } from '../../../lib/api-client'

// Define Zod schemas to match the shared LeaderboardEntry type
const LeaderboardUserBadgeZ = z.object({
  badge: z.object({ 
    code: z.string(), 
    name: z.string(), 
    icon_url: z.string().nullable().optional() 
  })
})

const LeaderItemZ = z.object({
  rank: z.number(),
  user: z.object({
    id: z.string(),
    handle: z.string(),
    name: z.string(),
    avatar_url: z.string().nullable().optional(),
    school: z.string().nullable().optional(),
    earned_badges: z.array(LeaderboardUserBadgeZ).optional(),
    _sum: z.object({ points: z.number() }).optional(),
    points: z.number().optional()
  })
})

async function fetchLeaderboard(period: 'all' | '30d', limit = 20, offset = 0, search = '') {
  const api = getApiClient()
  const res = await api.getLeaderboard({ period, limit, offset, ...(search ? { search } : {}) })
  return res
}

function LeaderboardContent() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [period, setPeriod] = useState<'all' | '30d'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchLeaderboard(period, 20, 0, '')
        setData(result.data.data as LeaderboardEntry[])
        setTotal(result.data.total)
        setHasMore(result.data.hasMore)
      } catch (err) {
        setError('Failed to load leaderboard data')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [period])

  const handlePeriodChange = (newPeriod: 'all' | '30d') => {
    setPeriod(newPeriod)
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading Leaderboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
            <p className="mt-2 text-lg text-gray-600">
              Top educators leading Indonesia's AI education transformation
            </p>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LeaderboardTable
          data={data}
          period={period}
          loading={loading}
          onPeriodChange={handlePeriodChange}
          showSearch={true}
          showPagination={true}
          getProfilePath={getProfilePath}
        />
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LeaderboardContent />
    </Suspense>
  )
}
