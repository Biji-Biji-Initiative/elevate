'use client';

import { Suspense, useEffect, useState } from 'react'

import Link from 'next/link'

import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'

import { z } from 'zod'
import { StageCard, Button, LoadingSpinner } from '@elevate/ui'
import { getApiClient } from '../../lib/api-client'

interface PlatformStats {
  totalEducators: number
  totalSubmissions: number
  totalPoints: number
  studentsImpacted: number
  byStage: Record<string, {
    total: number
    approved: number
    pending: number
    rejected: number
  }>
}

async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const api = getApiClient()
    const res = await api.getStats()
    return (res as any).data as PlatformStats
  } catch (_) {
    return null
  }
}

function StatsSection() {
  const t = useTranslations('homepage');
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchPlatformStats()
        setStats(data)
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }

    void loadStats()
  }, [])

  if (loading) {
    return (
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <LoadingSpinner />
          </div>
        </div>
      </section>
    )
  }

  const displayStats = stats || {
    totalEducators: 0,
    totalSubmissions: 0,
    totalPoints: 0,
    studentsImpacted: 0
  }

  return (
    <section className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Join Indonesia's Leading Educators
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Over {displayStats.totalEducators.toLocaleString()} educators are already transforming their classrooms with AI. 
            Track your progress through the LEAPS framework and join our vibrant community.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {displayStats.totalEducators.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">{t('stats.educators')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {displayStats.totalSubmissions.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">{t('stats.completed')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {displayStats.totalPoints.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">{t('stats.points')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {displayStats.studentsImpacted.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Students Impacted</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LeapsSection() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchPlatformStats()
        setStats(data)
      } catch (error) {
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
            A structured 5-stage journey designed to help educators integrate AI tools 
            effectively in their classrooms while building a community of practice.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {loading ? (
            <div className="col-span-full text-center">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <StageCard stage="learn" completedCount={getStageCount('learn')} />
              <StageCard stage="explore" completedCount={getStageCount('explore')} />
              <StageCard stage="amplify" completedCount={getStageCount('amplify')} />
              <StageCard stage="present" completedCount={getStageCount('present')} />
              <StageCard stage="shine" completedCount={getStageCount('shine')} />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Page() {
  const t = useTranslations('homepage');
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t('hero_title')}
            </h1>
            <p className="text-xl md:text-2xl mb-4 text-blue-100">
              {t('subtitle')}
            </p>
            <p className="text-lg mb-8 text-blue-200 max-w-3xl mx-auto">
              {t('hero_subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="default" className="bg-white text-blue-600 hover:bg-gray-100">
                    {t('get_started')}
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <Button variant="default" className="bg-white text-blue-600 hover:bg-gray-100">
                    Go to Dashboard
                  </Button>
                </Link>
              </SignedIn>
              <Link href="/leaderboard">
                <Button variant="ghost" className="border-white text-white hover:bg-white hover:text-blue-600">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LEAPS Framework Section */}
      <LeapsSection />

      {/* Stats Section */}
      <StatsSection />

      {/* Benefits Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Join MS Elevate?
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-3">Structured Learning Path</h3>
              <p className="text-gray-600">
                Follow a proven framework designed by education experts to gradually 
                integrate AI tools into your teaching practice.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-semibold mb-3">Recognition & Rewards</h3>
              <p className="text-gray-600">
                Earn points, badges, and public recognition for your achievements. 
                Top performers get featured on our leaderboard.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold mb-3">Community Support</h3>
              <p className="text-gray-600">
                Connect with like-minded educators, share experiences, and learn 
                from the most innovative teachers across Indonesia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Success Stories
            </h2>
            <p className="text-xl text-gray-600">
              See how educators are transforming their classrooms with AI
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">S</span>
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">Siti Nurhaliza</h4>
                  <p className="text-sm text-gray-600">Jakarta • 185 points</p>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "The LEAPS framework helped me integrate AI tools seamlessly into my math classes. 
                My students are more engaged than ever!"
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">B</span>
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">Budi Santoso</h4>
                  <p className="text-sm text-gray-600">Surabaya • 167 points</p>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "From learning to training 50+ peers, the journey has been incredible. 
                AI is now part of our school culture."
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">R</span>
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold">Ratna Dewi</h4>
                  <p className="text-sm text-gray-600">Bandung • 142 points</p>
                </div>
              </div>
              <p className="text-gray-700 italic">
                "The community support is amazing. I've learned so much from other educators 
                and gained confidence in using AI tools."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Teaching?
          </h2>
          <p className="text-xl mb-8 text-purple-100">
            Join thousands of Indonesian educators who are already using AI to enhance their teaching. 
            Start your LEAPS journey today.
          </p>
          
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="default" className="bg-white text-purple-600 hover:bg-gray-100">
                Get Started Now
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="default" className="bg-white text-purple-600 hover:bg-gray-100">
                Continue Your Journey
              </Button>
            </Link>
          </SignedIn>
        </div>
      </section>
    </div>
  )
}
