'use client'

import { useState, useEffect } from 'react'
import { Suspense } from 'react'
import { LeaderboardTable, PageLoading } from '@elevate/ui'
import { getProfilePath } from '@elevate/types'

interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    handle: string
    name: string
    school?: string
    avatar_url?: string
    earned_badges?: Array<{
      badge: {
        code: string
        name: string
        icon_url?: string
      }
    }>
    _sum: {
      points: number
    }
  }
}

async function fetchLeaderboard(period: 'all' | '30d', limit = 20, offset = 0, search = '') {
  try {
    const params = new URLSearchParams({
      period,
      limit: limit.toString(),
      offset: offset.toString(),
      ...(search && { search })
    })
    
    const response = await fetch(`/api/leaderboard?${params}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    return result
  } catch (error) {
    throw error
  }
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
        setData(result.data || [])
        setTotal(result.total || 0)
        setHasMore(result.hasMore || false)
      } catch (err) {
        setError('Failed to load leaderboard data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
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
