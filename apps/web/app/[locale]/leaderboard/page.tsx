'use client'

import { useState, useEffect, Suspense } from 'react'

import Link from 'next/link'

import { getProfilePath, type LeaderboardEntryDTO } from '@elevate/types'
import { LeaderboardTable, PageLoading } from '@elevate/ui/blocks'

// Use public API route for client-side fetch

type LeaderboardApiUser = {
  id: string
  handle: string
  name: string
  school?: string | null
  avatarUrl?: string | null
  totalPoints: number
  earnedBadges?: Array<{ badge: { code: string; name: string; iconUrl?: string | null } }>
}

type LeaderboardApiEntry = { rank: number; user: LeaderboardApiUser }

async function fetchLeaderboard(
  period: 'all' | '30d',
  limit = 20,
  offset = 0,
  search = '',
): Promise<LeaderboardEntryDTO[]> {
  const params = new URLSearchParams({ period, limit: String(limit), offset: String(offset) })
  if (search) params.set('search', search)
  const res = await fetch(`/api/leaderboard?${params.toString()}`)
  if (!res.ok) return []
  const body: unknown = await res.json()
  let rows: LeaderboardApiEntry[] = []
  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    Array.isArray((body as { data: unknown }).data)
  ) {
    rows = (body as { data: LeaderboardApiEntry[] }).data
  } else if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    typeof (body as { data: unknown }).data === 'object' &&
    body !== null &&
    Array.isArray((body as { data: { data?: unknown } }).data?.data)
  ) {
    rows = ((body as { data: { data: LeaderboardApiEntry[] } }).data).data
  }
  // Normalize to LeaderboardEntryDTO to satisfy iconUrl type (omit when undefined)
  return rows.map((e) => ({
    rank: e.rank,
    user: {
      id: e.user.id,
      handle: e.user.handle,
      name: e.user.name,
      school: e.user.school ?? null,
      avatarUrl: e.user.avatarUrl ?? null,
      totalPoints: e.user.totalPoints,
      earnedBadges: Array.isArray(e.user.earnedBadges)
        ? e.user.earnedBadges.map((eb) => ({
            badge: {
              code: eb?.badge?.code ?? '',
              name: eb?.badge?.name ?? '',
              ...(eb?.badge?.iconUrl !== undefined
                ? { iconUrl: eb.badge.iconUrl }
                : {}),
            },
          }))
        : undefined,
    },
  }))
}

function LeaderboardContent() {
  const [data, setData] = useState<LeaderboardEntryDTO[]>([])
  const [period, setPeriod] = useState<'all' | '30d'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Server returns total/hasMore; local table paginates client-side, so omit state

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const entries = await fetchLeaderboard(period, 20, 0, '')
        setData(entries)
        // result.data.total and hasMore are available if needed for future server pagination
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
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            Error Loading Leaderboard
          </h3>
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
          Link={Link}
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
