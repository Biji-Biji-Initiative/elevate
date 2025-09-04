'use client'

import React from 'react'

import { Button } from '../../components/ui/button'

export interface ConveningTeaserProps {
  title: string
  description: string
  ctaLabel: string
  onCTAClick: () => void
  className?: string
}

export function ConveningTeaser({
  title,
  description,
  ctaLabel,
  onCTAClick,
  className = '',
}: ConveningTeaserProps) {
  return (
    <section
      className={`py-16 bg-gradient-to-r from-yellow-400 to-orange-500 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {title}
          </h2>

          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8 leading-relaxed">
            {description}
          </p>

          <Button
            onClick={onCTAClick}
            variant="outline"
            className="bg-white text-orange-600 border-white hover:bg-orange-50 hover:text-orange-700"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
