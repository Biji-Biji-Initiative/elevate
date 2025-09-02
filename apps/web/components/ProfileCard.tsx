'use client'

import Link from 'next/link'

interface ProfileCardProps {
  user: {
    id: string
    handle: string
    name: string
    email?: string
    school?: string | null
    cohort?: string | null
    avatar_url?: string | null
    earned_badges?: Array<{
      badge: {
        code: string
        name: string
        icon_url?: string | null
      }
    }>
    _sum?: {
      points: number | null
    }
  }
  rank?: number
  showRank?: boolean
  compact?: boolean
}

export function ProfileCard({ user, rank, showRank = false, compact = false }: ProfileCardProps) {
  const totalPoints = user._sum?.points || 0
  
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${compact ? 'text-sm' : ''}`}>
      <Link href={`/u/${user.handle}`} className="block">
        <div className="flex items-start space-x-3">
          {showRank && rank && (
            <div className={`flex-shrink-0 ${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gray-100 flex items-center justify-center`}>
              <span className={`font-bold text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                #{rank}
              </span>
            </div>
          )}
          
          <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0`}>
            <span className={`text-white font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-gray-900 truncate ${compact ? 'text-sm' : 'text-base'}`}>
              {user.name}
            </h3>
            <p className={`text-gray-500 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              @{user.handle}
            </p>
            {user.school && (
              <p className={`text-gray-500 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                {user.school}
              </p>
            )}
            
            <div className={`flex items-center justify-between ${compact ? 'mt-1' : 'mt-2'}`}>
              <span className={`font-bold text-blue-600 ${compact ? 'text-sm' : 'text-lg'}`}>
                {totalPoints.toLocaleString()} pts
              </span>
              
              {user.earned_badges && user.earned_badges.length > 0 && (
                <div className="flex space-x-1">
                  {user.earned_badges.slice(0, 3).map((earnedBadge) => (
                    <div 
                      key={earnedBadge.badge.code}
                      className={`${compact ? 'w-4 h-4 text-xs' : 'w-6 h-6 text-sm'} bg-yellow-100 rounded-full flex items-center justify-center`}
                      title={earnedBadge.badge.name}
                    >
                      🏆
                    </div>
                  ))}
                  {user.earned_badges.length > 3 && (
                    <div className={`${compact ? 'w-4 h-4 text-xs' : 'w-6 h-6 text-sm'} bg-gray-100 rounded-full flex items-center justify-center text-gray-600`}>
                      +{user.earned_badges.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}