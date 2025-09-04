'use client'

import React, { useEffect, useRef } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

import { LoadingSpinner } from './LoadingSpinner'

export interface StoryEntry {
  id: string
  imageUrl?: string
  schoolRegion: string
  challenge: string
  aiTool: string
  resultMetric: string
  linkedinUrl: string
  badgeCode?: string
  badgeName?: string
}

export interface StoriesGridProps {
  title: string
  subtitle: string
  stories: StoryEntry[]
  loading?: boolean
  emptyStateMessage?: string
  ctaLabel: string
  onCTAClick: () => void
  onStoryClick?: (story: StoryEntry) => void
  onStoryView?: (story: StoryEntry) => void
  className?: string
}

export function StoriesGrid({
  title,
  subtitle,
  stories,
  loading = false,
  emptyStateMessage = 'Be the first to share your story',
  ctaLabel,
  onCTAClick,
  onStoryClick,
  onStoryView,
  className = '',
}: StoriesGridProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const viewedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!onStoryView || stories.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.storyId
            if (id && !viewedIdsRef.current.has(id)) {
              const story = stories.find((s) => s.id === id)
              if (story) {
                viewedIdsRef.current.add(id)
                onStoryView(story)
              }
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    Object.values(cardRefs.current).forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [onStoryView, stories])
  if (loading) {
    return (
      <section className={`py-16 bg-white ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <LoadingSpinner />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`py-16 bg-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{subtitle}</p>
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-6">
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No stories yet
            </h3>
            <p className="text-gray-600 mb-6">{emptyStateMessage}</p>
            <Button onClick={onCTAClick}>{ctaLabel}</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {stories.map((story) => (
                <div
                  key={story.id}
                  ref={(el) => {
                    cardRefs.current[story.id] = el
                  }}
                  data-story-id={story.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  role={onStoryClick ? 'button' : undefined}
                  tabIndex={onStoryClick ? 0 : -1}
                  onClick={() => onStoryClick?.(story)}
                  onKeyDown={(e) => {
                    if (!onStoryClick) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onStoryClick(story)
                    }
                  }}
                >
                  {story.imageUrl && (
                    <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                      <img
                        src={story.imageUrl}
                        alt={`Classroom implementation: ${story.challenge}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-sm text-gray-600">
                        {story.schoolRegion}
                      </div>
                      {story.badgeCode && (
                        <Badge variant="secondary" className="text-xs">
                          {story.badgeName || story.badgeCode}
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {story.challenge}
                    </h3>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium">AI Tool:</span>{' '}
                        {story.aiTool}
                      </div>
                      <div>
                        <span className="font-medium">Result:</span>{' '}
                        {story.resultMetric}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <a
                        href={story.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View post
                        <svg
                          className="ml-1 w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Button onClick={onCTAClick}>{ctaLabel}</Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
