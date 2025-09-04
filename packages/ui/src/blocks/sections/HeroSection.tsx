'use client'

import React from 'react'

import { Button } from '../../components/ui/button'
import { LoadingSpinner } from '../LoadingSpinner'

export interface HeroCounters {
  educators_learning: number
  peers_students_reached: number
  stories_shared: number
  micro_credentials: number
  mce_certified: number
}

export interface HeroCountersLabels {
  educators_learning: string
  peers_students_reached: string
  stories_shared: string
  micro_credentials: string
  mce_certified: string
}

export interface HeroSectionProps {
  title: string
  subtitle: string
  description: string
  primaryCTA: {
    label: string
    onClick: () => void
  }
  secondaryCTA: {
    label: string
    onClick: () => void
  }
  counters?: HeroCounters | null
  countersLabels?: HeroCountersLabels
  countersLoading?: boolean
  partnersLogos?: React.ReactNode
  children?: React.ReactNode // For leaderboard preview or other content
  className?: string
}

export function HeroSection({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  counters,
  countersLabels,
  countersLoading = false,
  partnersLogos,
  children,
  className = '',
}: HeroSectionProps) {
  const displayCounters = counters || {
    educators_learning: 0,
    peers_students_reached: 0,
    stories_shared: 0,
    micro_credentials: 0,
    mce_certified: 0,
  }

  const defaultLabels: HeroCountersLabels = {
    educators_learning: 'Educators learning',
    peers_students_reached: 'Peers & students reached',
    stories_shared: 'Stories shared',
    micro_credentials: 'Micro-credentials',
    mce_certified: 'MCE certified',
  }

  const labels = countersLabels || defaultLabels

  return (
    <section
      className={`bg-gradient-to-r from-blue-600 to-purple-700 text-white py-20 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{title}</h1>
          <p className="text-xl md:text-2xl mb-4 text-blue-100">{subtitle}</p>
          <p className="text-lg mb-8 text-blue-200 max-w-3xl mx-auto">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              variant="default"
              className="bg-white text-blue-600 hover:bg-gray-100"
              onClick={primaryCTA.onClick}
            >
              {primaryCTA.label}
            </Button>
            <Button
              variant="ghost"
              className="border-white text-white hover:bg-white hover:text-blue-600"
              onClick={secondaryCTA.onClick}
            >
              {secondaryCTA.label}
            </Button>
          </div>

          {/* Impact Counters Strip */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
            {countersLoading ? (
              <div className="flex justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl md:text-3xl font-bold">
                    {displayCounters.educators_learning.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-200">
                    {labels.educators_learning}
                  </div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">
                    {displayCounters.peers_students_reached.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-200">
                    {labels.peers_students_reached}
                  </div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">
                    {displayCounters.stories_shared.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-200">
                    {labels.stories_shared}
                  </div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">
                    {displayCounters.micro_credentials.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-200">
                    {labels.micro_credentials}
                  </div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold">
                    {displayCounters.mce_certified.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-200">
                    {labels.mce_certified}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Partners Logos */}
          {partnersLogos && <div className="mb-8">{partnersLogos}</div>}

          {/* Children slot for leaderboard preview or other content */}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  )
}
