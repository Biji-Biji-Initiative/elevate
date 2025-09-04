'use client'

import React from 'react'

import { Badge } from '../components/ui/badge'

import { LoadingSpinner } from './LoadingSpinner'

export interface LeaderboardPreviewEntry {
  rank: number
  user: {
    name: string
    handle: string
    school?: string | null
    avatar_url?: string | null
  }
  points: number
  badges?: Array<{
    code: string
    name: string
  }>
}

export interface LeaderboardPreviewProps {
  entries: LeaderboardPreviewEntry[]
  loading?: boolean
  emptyMessage?: string
  className?: string
}

export function LeaderboardPreview({
  entries,
  loading = false,
  emptyMessage = 'Your name could be here this week.',
  className = '',
}: LeaderboardPreviewProps) {
  if (loading) {
    return (
      <div
        className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 ${className}`}
      >
        <div className="text-center">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center ${className}`}
      >
        <div className="text-white/80 mb-2">
          <svg
            className="mx-auto h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
        </div>
        <div className="text-white font-medium">Top Educators</div>
        <div className="text-white/70 text-sm">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-white font-semibold text-lg">Top Educators</h3>
        <p className="text-white/70 text-sm">
          Leading Indonesia's AI education transformation
        </p>
      </div>

      <div className="space-y-3">
        {entries.slice(0, 3).map((entry) => (
          <div
            key={entry.user.handle}
            className="flex items-center space-x-3 bg-white/5 rounded-lg p-3"
          >
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
                #{entry.rank}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">
                {entry.user.name}
              </div>
              {entry.user.school && (
                <div className="text-white/70 text-xs truncate">
                  {entry.user.school}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="text-white font-bold">
                {entry.points.toLocaleString()}
              </div>
              <div className="text-white/70 text-xs">points</div>
            </div>

            {entry.badges && entry.badges.length > 0 && (
              <div className="flex-shrink-0">
                <Badge
                  variant="secondary"
                  className="bg-white/20 text-white text-xs"
                >
                  {entry.badges.length} badge
                  {entry.badges.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        <div className="text-white/70 text-xs">View full leaderboard →</div>
      </div>
    </div>
  )
}
