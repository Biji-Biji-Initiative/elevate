'use client'

import React from 'react'

import Link from 'next/link'

interface StageCardProps {
  stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'
  title: string
  description: string
  points: string
  color: string
  icon: string
  completedCount?: number
  isClickable?: boolean
}

const stageInfo = {
  learn: {
    title: 'Learn',
    description: 'Complete AI education courses and earn certificates',
    points: '20 pts',
    color: 'from-blue-500 to-blue-600',
    icon: '📚',
  },
  explore: {
    title: 'Explore',
    description: 'Apply AI tools in classroom with evidence submission',
    points: '50 pts',
    color: 'from-green-500 to-green-600',
    icon: '🔍',
  },
  amplify: {
    title: 'Amplify',
    description: 'Train peers and students in AI implementation',
    points: '2/peer • 1/student',
    color: 'from-purple-500 to-purple-600',
    icon: '📢',
  },
  present: {
    title: 'Present',
    description: 'Share success stories on LinkedIn with evidence',
    points: '20 pts',
    color: 'from-orange-500 to-orange-600',
    icon: '📱',
  },
  shine: {
    title: 'Shine',
    description: 'Submit innovative ideas for recognition and awards',
    points: 'Recognition',
    color: 'from-yellow-500 to-yellow-600',
    icon: '✨',
  },
}

export function StageCard({ 
  stage, 
  completedCount,
  isClickable = true 
}: { 
  stage: keyof typeof stageInfo
  completedCount?: number
  isClickable?: boolean
}) {
  const info = stageInfo[stage]
  
  const CardContent = () => (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${info.color}`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">{info.icon}</span>
            <h3 className="text-xl font-semibold text-gray-900">{info.title}</h3>
          </div>
          
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            {info.description}
          </p>
          
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${info.color} text-white`}>
              {info.points}
            </span>
            {completedCount !== undefined && (
              <span className="text-sm text-gray-500">
                {completedCount.toLocaleString()} completed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
  
  if (isClickable) {
    return (
      <Link href={`/metrics/${stage}`} className="block">
        <CardContent />
      </Link>
    )
  }
  
  return <CardContent />
}