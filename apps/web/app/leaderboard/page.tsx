'use client'

import { useState, useEffect } from 'react'
import { Suspense } from 'react'
import { LeaderboardTable } from '../../components/LeaderboardTable'
import { PageLoading } from '../../components/LoadingSpinner'

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

// Mock data - in production this would come from the API
const mockLeaderboardData: LeaderboardEntry[] = [
  {
    rank: 1,
    user: {
      id: '1',
      handle: 'siti_nurhaliza',
      name: 'Siti Nurhaliza',
      school: 'SMA Negeri 1 Jakarta',
      _sum: { points: 185 },
      earned_badges: [
        { badge: { code: 'LEARN_MASTER', name: 'Learn Master' } },
        { badge: { code: 'EXPLORER', name: 'Explorer' } },
      ]
    }
  },
  {
    rank: 2,
    user: {
      id: '2',
      handle: 'budi_santoso',
      name: 'Budi Santoso',
      school: 'SMA Negeri 2 Surabaya',
      _sum: { points: 167 },
      earned_badges: [
        { badge: { code: 'AMPLIFIER', name: 'Amplifier' } },
      ]
    }
  },
  {
    rank: 3,
    user: {
      id: '3',
      handle: 'ratna_dewi',
      name: 'Ratna Dewi',
      school: 'SMA Negeri 1 Bandung',
      _sum: { points: 142 },
      earned_badges: [
        { badge: { code: 'PRESENTER', name: 'Presenter' } },
        { badge: { code: 'SHINER', name: 'Shiner' } },
        { badge: { code: 'COMMUNITY_STAR', name: 'Community Star' } },
      ]
    }
  },
  {
    rank: 4,
    user: {
      id: '4',
      handle: 'ahmad_rizki',
      name: 'Ahmad Rizki',
      school: 'SMA Negeri 3 Medan',
      _sum: { points: 128 },
      earned_badges: []
    }
  },
  {
    rank: 5,
    user: {
      id: '5',
      handle: 'maya_sari',
      name: 'Maya Sari',
      school: 'SMA Negeri 1 Yogyakarta',
      _sum: { points: 115 },
      earned_badges: [
        { badge: { code: 'EARLY_ADOPTER', name: 'Early Adopter' } },
      ]
    }
  },
  // Add more mock entries...
  ...Array.from({ length: 15 }, (_, i) => ({
    rank: i + 6,
    user: {
      id: `${i + 6}`,
      handle: `educator_${i + 6}`,
      name: `Educator ${i + 6}`,
      school: `School ${i + 6}`,
      _sum: { points: Math.max(10, 110 - i * 5) },
      earned_badges: Math.random() > 0.5 ? [
        { badge: { code: 'BADGE_1', name: 'Achievement Badge' } },
      ] : []
    }
  }))
]

async function fetchLeaderboard(period: 'all' | '30d') {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // In production, this would fetch from /api/leaderboard?period=${period}
  return mockLeaderboardData.map(entry => ({
    ...entry,
    user: {
      ...entry.user,
      _sum: {
        points: period === '30d' ? Math.floor(entry.user._sum.points * 0.3) : entry.user._sum.points
      }
    }
  })).sort((a, b) => b.user._sum.points - a.user._sum.points).map((entry, index) => ({
    ...entry,
    rank: index + 1
  }))
}

function LeaderboardContent() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [period, setPeriod] = useState<'all' | '30d'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchLeaderboard(period)
        setData(result)
      } catch (err) {
        setError('Failed to load leaderboard data')
        console.error('Leaderboard fetch error:', err)
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
