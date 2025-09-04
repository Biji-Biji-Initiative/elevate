'use client'

import { Suspense, useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'

import {
  StoriesGrid,
  LeaderboardPreview,
  StageCard,
  LoadingSpinner,
  type StoryEntry,
  type LeaderboardPreviewEntry,
} from '@elevate/ui/blocks'
import {
  HeroSection,
  ImpactRipple,
  ProgramFlow,
  DualPaths,
  ConveningTeaser,
  FAQList,
  PartnersContact,
  type HeroCounters,
  type FAQItem,
} from '@elevate/ui/blocks/sections'

import { analytics, useScrollDepthTracking } from '../../lib/analytics'
import { getApiClient } from '../../lib/api-client'
import type { StatsResponseDTO, LeaderboardEntryDTO } from '@elevate/types'

interface PlatformStats {
  totalEducators: number
  totalSubmissions: number
  totalPoints: number
  studentsImpacted: number
  counters?: HeroCounters
  byStage: Record<
    string,
    {
      total: number
      approved: number
      pending: number
      rejected: number
    }
  >
}

interface StoriesResponse {
  stories: StoryEntry[]
  pagination: {
    total: number
    hasMore: boolean
  }
}


async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const api = getApiClient()
    const res = await api.getStats()
    const stats = res.data as StatsResponseDTO

    const byStage: PlatformStats['byStage'] = Object.fromEntries(
      Object.entries(stats.byStage).map(([key, value]) => [
        key,
        {
          total: value.total,
          approved: value.approved,
          pending: value.pending,
          rejected: value.rejected,
        },
      ])
    )

    return {
      totalEducators: stats.totalEducators,
      totalSubmissions: stats.totalSubmissions,
      totalPoints: stats.totalPoints,
      studentsImpacted: stats.studentsImpacted ?? 0,
      byStage,
    }
  } catch (_) {
    return null
  }
}


async function fetchLeaderboardPreview(): Promise<LeaderboardPreviewEntry[]> {
  try {
    const api = getApiClient()
    const res = await api.getLeaderboard({ limit: 3 })
    const payload = res.data.data as LeaderboardEntryDTO[]

    return payload.map((entry) => ({
      rank: entry.rank,
      user: {
        name: entry.user.name,
        handle: entry.user.handle,
        school: entry.user.school ?? null,
        avatar_url: entry.user.avatarUrl ?? null,
      },
      points: entry.user.totalPoints,
      badges:
        entry.user.earnedBadges?.map((b) => ({ code: b.badge.code, name: b.badge.name })) ?? [],
    }))
  } catch (_) {
    return []
  }
}

async function fetchStories(): Promise<StoryEntry[]> {
  try {
    const response = await fetch('/api/stories?limit=6')
    if (!response.ok) return []

    const data: StoriesResponse = await response.json()
    return data.stories || []
  } catch (_) {
    return []
  }
}

function LeapsSection() {
  const t = useTranslations('homepage.leaps')
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchPlatformStats()
        setStats(data)
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false)
      }
    }

    void loadStats()
  }, [])

  const getStageCount = (stage: string): number => {
    if (!stats?.byStage) return 0
    return stats.byStage[stage.toUpperCase()]?.approved || 0
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            The LEAPS Framework
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('intro')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {loading ? (
            <div className="col-span-full text-center">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <StageCard
                stage="learn"
                completedCount={getStageCount('learn')}
              />
              <StageCard
                stage="explore"
                completedCount={getStageCount('explore')}
              />
              <StageCard
                stage="amplify"
                completedCount={getStageCount('amplify')}
              />
              <StageCard
                stage="present"
                completedCount={getStageCount('present')}
              />
              <StageCard
                stage="shine"
                completedCount={getStageCount('shine')}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Page() {
  const t = useTranslations('homepage')
  const router = useRouter()

  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardPreviewEntry[]>([])
  const [stories, setStories] = useState<StoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Track page view and scroll depth
  useScrollDepthTracking()
  useEffect(() => {
    analytics.pageView('home')
  }, [])

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, leaderboardData, storiesData] = await Promise.all([
          fetchPlatformStats(),
          fetchLeaderboardPreview(),
          fetchStories(),
        ])

        setStats(statsData)
        setLeaderboard(leaderboardData)
        setStories(storiesData)
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  // Event handlers
  const handlePrimaryCTA = () => {
    analytics.ctaClick({ area: 'hero', label: 'join_leaps' })
    // Navigate to sign-in or dashboard based on auth state
    const signInButton = document.querySelector(
      '[data-clerk-sign-in]',
    ) as HTMLElement
    if (signInButton) {
      signInButton.click()
    } else {
      router.push('/dashboard')
    }
  }

  const handleSecondaryCTA = () => {
    analytics.ctaClick({ area: 'hero', label: 'see_live_progress' })
    router.push('/leaderboard')
  }

  const handleStoryCTA = () => {
    analytics.ctaClick({ area: 'stories', label: 'publish_story' })
    router.push('/dashboard/present')
  }

  const handleEducatorPath = () => {
    analytics.ctaClick({ area: 'dual_paths', label: 'start_now' })
    router.push('/dashboard/learn')
  }

  const handleTrainerPath = () => {
    analytics.ctaClick({ area: 'dual_paths', label: 'become_trainer' })
    // Placeholder - could link to external form or feature-flagged page
    window.open(
      'mailto:rashvin@biji-biji.com?subject=Master Trainer Interest',
      '_blank',
    )
  }

  const handleConveningCTA = () => {
    analytics.ctaClick({ area: 'convening', label: 'see_criteria' })
    router.push('/dashboard/shine')
  }

  const handleStoryClick = (story: StoryEntry) => {
    analytics.ugcClick({ post_id: story.id })
    if (story.linkedinUrl) {
      window.open(story.linkedinUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleStoryView = (story: StoryEntry) => {
    analytics.ugcView({ post_id: story.id })
  }

  // FAQ data (from spec)
  const faqItems: FAQItem[] = [
    {
      id: '1',
      question: 'Is "AI for Educators" available in Bahasa Indonesia?',
      answer:
        'We are working with Microsoft to confirm availability in Bahasa Indonesia.',
      status: 'pending',
      owner: 'Microsoft',
    },
    {
      id: '2',
      question: 'Can materials be simplified if learning objectives are met?',
      answer: 'We are reviewing flexibility options with Microsoft.',
      status: 'pending',
      owner: 'Microsoft',
    },
    {
      id: '3',
      question:
        'Kemendikdasmen task letter routing (Disdik vs direct to schools)?',
      answer: 'Clarification needed on the official routing process.',
      status: 'pending',
      owner: 'MOE',
    },
    {
      id: '4',
      question: 'Is Level 2 gated by completing Level 1?',
      answer: 'Program team is finalizing the progression requirements.',
      status: 'pending',
      owner: 'Program Team',
    },
    {
      id: '5',
      question:
        '21st Century Learning deliverable: knowledge transfer vs end-to-end to MCE? Duration flexibility?',
      answer: 'Microsoft is reviewing the scope and duration requirements.',
      status: 'pending',
      owner: 'Microsoft',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection
        title={t('hero.h1')}
        subtitle={t('hero.subcopy')}
        description={t('hero.subcopy')}
        primaryCTA={{
          label: t('hero.cta_primary'),
          onClick: handlePrimaryCTA,
        }}
        secondaryCTA={{
          label: t('hero.cta_secondary'),
          onClick: handleSecondaryCTA,
        }}
        counters={stats?.counters || null}
        countersLabels={{
          educators_learning: t('hero.counters.educators_learning'),
          peers_students_reached: t('hero.counters.peers_students_reached'),
          stories_shared: t('hero.counters.stories_shared'),
          micro_credentials: t('hero.counters.micro_credentials'),
          mce_certified: t('hero.counters.mce_certified'),
        }}
        countersLoading={loading}
        partnersLogos={
          <div className="flex flex-wrap justify-center items-center gap-8 text-white/70">
            {['Microsoft', 'MOE', 'Biji-biji', 'Mata Garuda', 'MIEE'].map(
              (partner: string, index: number) => (
                <span key={index} className="text-lg font-medium">
                  {partner}
                </span>
              ),
            )}
          </div>
        }
      >
        {/* Leaderboard Preview in Hero */}
        <div onClick={() => router.push('/leaderboard')} role="link">
          <LeaderboardPreview
            entries={leaderboard}
            loading={loading}
            emptyMessage={t('empty_states.leaderboard_empty')}
          />
        </div>
      </HeroSection>

      {/* LEAPS Framework Section */}
      <LeapsSection />

      {/* Impact Ripple */}
      <ImpactRipple title={t('ripple.title')} description={t('ripple.body')} />

      {/* Program Flow */}
      <ProgramFlow
        title={t('flow.title')}
        bullets={[
          'MOE identifies participating schools; database anchors outreach.',
          'Registration via form routes educators to the LEAPS tracker (Entry & Sign-In → Tracker).',
          'Educators progress through LEAPS stages with support from Mentors.',
          'Points, leaderboards, and badges keep educators motivated.',
          'Top performers qualify for the Shine showcase in Jakarta.'
        ]}
      />

      {/* Stories Wall */}
      <StoriesGrid
        title={t('stories.title')}
        subtitle={t('stories.subcopy')}
        stories={stories}
        loading={loading}
        emptyStateMessage={t('stories.empty_state')}
        ctaLabel={t('stories.cta')}
        onCTAClick={handleStoryCTA}
        onStoryClick={handleStoryClick}
        onStoryView={handleStoryView}
      />

      {/* Dual Paths */}
      <DualPaths
        educatorPath={{
          title: t('paths.educator.title'),
          description: t('paths.educator.body'),
          ctaLabel: t('paths.educator.cta'),
          onCTAClick: handleEducatorPath,
        }}
        trainerPath={{
          title: t('paths.trainer.title'),
          description: t('paths.trainer.body'),
          ctaLabel: t('paths.trainer.cta'),
          onCTAClick: handleTrainerPath,
        }}
      />

      {/* Convening Teaser */}
      <ConveningTeaser
        title={t('convening.title')}
        description={t('convening.body')}
        ctaLabel={t('convening.cta')}
        onCTAClick={handleConveningCTA}
      />

      {/* FAQ */}
      <FAQList items={faqItems} footerNote={t('faq.footer')} />

      {/* Partners & Contact */}
      <PartnersContact
        partners={['Microsoft', 'MOE', 'Biji-biji', 'Mata Garuda', 'MIEE']}
        contacts={[
          {
            email: 'rashvin@biji-biji.com',
            phone: '+60 122 916 662',
            name: 'Rashvin',
          },
          {
            email: 'fabsya@biji-biji.com',
            phone: '+62 821 3747 0028',
            name: 'Fabsya',
          },
        ]}
      />

      {/* Hidden sign-in trigger for analytics */}
      <SignedOut>
        <SignInButton mode="modal">
          <button data-clerk-sign-in className="hidden" />
        </SignInButton>
      </SignedOut>
    </div>
  )
}
