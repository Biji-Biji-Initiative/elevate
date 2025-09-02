import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { ShareButton, SocialShareButtons } from '../../../components/ShareButton'
import { StageCard } from '../../../components/StageCard'
import { PageLoading } from '../../../components/LoadingSpinner'
import { getProfileUrl } from '@elevate/types'

interface ProfilePageProps {
  params: Promise<{
    handle: string
  }>
}

interface UserProfile {
  id: string
  handle: string
  name: string
  email: string
  avatar_url?: string
  school?: string
  cohort?: string
  created_at: string
  submissions: Array<{
    id: string
    activity_code: string
    activity: {
      name: string
      code: string
    }
    status: 'APPROVED' | 'PENDING' | 'REJECTED'
    visibility: 'PUBLIC' | 'PRIVATE'
    payload: any
    created_at: string
    updated_at: string
  }>
  earned_badges: Array<{
    badge: {
      code: string
      name: string
      description: string
      icon_url?: string
    }
    earned_at: string
  }>
  _sum: {
    points: number
  }
}

// Mock data - in production this would come from the API
const mockUserProfile: UserProfile = {
  id: '1',
  handle: 'siti_nurhaliza',
  name: 'Siti Nurhaliza',
  email: 'siti@example.com',
  school: 'SMA Negeri 1 Jakarta',
  cohort: 'Jakarta 2024',
  created_at: '2024-01-15T08:00:00Z',
  _sum: { points: 185 },
  earned_badges: [
    {
      badge: {
        code: 'LEARN_MASTER',
        name: 'Learn Master',
        description: 'Completed multiple learning courses',
      },
      earned_at: '2024-02-01T10:00:00Z'
    },
    {
      badge: {
        code: 'EXPLORER',
        name: 'Explorer',
        description: 'Successfully applied AI tools in classroom',
      },
      earned_at: '2024-03-15T14:30:00Z'
    },
    {
      badge: {
        code: 'COMMUNITY_STAR',
        name: 'Community Star',
        description: 'Active community contributor',
      },
      earned_at: '2024-04-10T09:15:00Z'
    }
  ],
  submissions: [
    {
      id: '1',
      activity_code: 'LEARN',
      activity: { name: 'Learn', code: 'LEARN' },
      status: 'APPROVED',
      visibility: 'PUBLIC',
      payload: {
        provider: 'ILS',
        course: 'AI in Education Fundamentals',
        completedAt: '2024-02-01'
      },
      created_at: '2024-02-01T08:00:00Z',
      updated_at: '2024-02-01T12:00:00Z'
    },
    {
      id: '2',
      activity_code: 'EXPLORE',
      activity: { name: 'Explore', code: 'EXPLORE' },
      status: 'APPROVED',
      visibility: 'PUBLIC',
      payload: {
        reflection: 'I successfully integrated ChatGPT into my math lessons to help students understand complex problems. Students showed 40% improvement in engagement.',
        classDate: '2024-03-15',
        school: 'SMA Negeri 1 Jakarta'
      },
      created_at: '2024-03-15T08:00:00Z',
      updated_at: '2024-03-15T16:00:00Z'
    },
    {
      id: '3',
      activity_code: 'PRESENT',
      activity: { name: 'Present', code: 'PRESENT' },
      status: 'APPROVED',
      visibility: 'PUBLIC',
      payload: {
        linkedinUrl: 'https://linkedin.com/posts/siti-nurhaliza-ai-classroom',
        caption: 'Sharing my AI journey in education with the community!'
      },
      created_at: '2024-04-10T08:00:00Z',
      updated_at: '2024-04-10T11:00:00Z'
    }
  ]
}

async function fetchUserProfile(handle: string): Promise<UserProfile | null> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // In production, this would fetch from /api/profile/${handle}
  if (handle === 'siti_nurhaliza') {
    return mockUserProfile
  }
  
  return null
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function ActivityTimeline({ submissions }: { submissions: UserProfile['submissions'] }) {
  const publicSubmissions = submissions.filter(s => s.visibility === 'PUBLIC' && s.status === 'APPROVED')
  
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Journey Timeline</h3>
      
      {publicSubmissions.length === 0 ? (
        <p className="text-gray-600">No public submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {publicSubmissions.map((submission, index) => (
            <div key={submission.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600">
                    {submission.activity.code.charAt(0)}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-lg font-medium text-gray-900">
                    {submission.activity.name}
                  </h4>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Approved
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  {formatDate(submission.created_at)}
                </p>
                
                {submission.activity_code === 'LEARN' && (
                  <p className="text-gray-700">
                    Completed: {submission.payload.course} via {submission.payload.provider}
                  </p>
                )}
                
                {submission.activity_code === 'EXPLORE' && (
                  <div>
                    <p className="text-gray-700 mb-2">
                      Applied AI in classroom on {formatDate(submission.payload.classDate)}
                    </p>
                    <blockquote className="pl-4 border-l-2 border-blue-200 text-gray-700 italic">
                      {submission.payload.reflection.substring(0, 200)}
                      {submission.payload.reflection.length > 200 && '...'}
                    </blockquote>
                  </div>
                )}
                
                {submission.activity_code === 'PRESENT' && (
                  <div>
                    <p className="text-gray-700 mb-2">Shared experience on LinkedIn</p>
                    <p className="text-blue-600 italic">"{submission.payload.caption}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function ProfileContent({ handle }: { handle: string }) {
  const profile = await fetchUserProfile(handle)
  
  if (!profile) {
    notFound()
  }
  
  const profileUrl = getProfileUrl(profile.handle)
  const stageBreakdown = profile.submissions
    .filter(s => s.status === 'APPROVED')
    .reduce((acc, submission) => {
      acc[submission.activity_code] = (acc[submission.activity_code] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start space-x-6">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-lg text-gray-600">@{profile.handle}</p>
              
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                {profile.school && (
                  <div className="flex items-center">
                    <span className="mr-1">🏫</span>
                    {profile.school}
                  </div>
                )}
                {profile.cohort && (
                  <div className="flex items-center">
                    <span className="mr-1">👥</span>
                    {profile.cohort}
                  </div>
                )}
                <div className="flex items-center">
                  <span className="mr-1">📅</span>
                  Joined {formatDate(profile.created_at)}
                </div>
              </div>
              
              <div className="mt-4 flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{profile._sum.points}</div>
                  <div className="text-sm text-gray-600">Total Points</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{profile.submissions.filter(s => s.status === 'APPROVED').length}</div>
                  <div className="text-sm text-gray-600">Achievements</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{profile.earned_badges.length}</div>
                  <div className="text-sm text-gray-600">Badges</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              <ShareButton 
                url={profileUrl}
                title={`${profile.name}'s LEAPS Journey`}
                text={`Check out ${profile.name}'s amazing progress in the MS Elevate LEAPS program!`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stage Progress */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">LEAPS Progress</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['learn', 'explore', 'amplify', 'present', 'shine'].map((stage) => {
                  const completedCount = stageBreakdown[stage.toUpperCase()] || 0
                  return (
                    <div key={stage} className="relative">
                      <StageCard 
                        stage={stage as any} 
                        completedCount={completedCount}
                        isClickable={false}
                      />
                      {completedCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-lg border p-6">
              <ActivityTimeline submissions={profile.submissions} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Badges Earned</h3>
              
              {profile.earned_badges.length === 0 ? (
                <p className="text-gray-600">No badges earned yet.</p>
              ) : (
                <div className="space-y-3">
                  {profile.earned_badges.map((earnedBadge) => (
                    <div key={earnedBadge.badge.code} className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-yellow-600">🏆</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900">
                          {earnedBadge.badge.name}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {earnedBadge.badge.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Earned {formatDate(earnedBadge.earned_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Share Profile */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Profile</h3>
              <SocialShareButtons
                url={profileUrl}
                title={`${profile.name}'s LEAPS Journey`}
                text={`Check out ${profile.name}'s amazing progress in the MS Elevate LEAPS program! 🚀`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  // In production, you'd fetch the profile data here for accurate metadata
  const { handle } = await params
  const profile = await fetchUserProfile(handle)
  
  if (!profile) {
    return {
      title: 'Profile Not Found - MS Elevate LEAPS Tracker',
      description: 'The requested educator profile could not be found.',
    }
  }

  const canonicalUrl = getProfileUrl(profile.handle)
  
  return {
    title: `${profile.name} (@${profile.handle}) - MS Elevate LEAPS Tracker`,
    description: `Follow ${profile.name}'s journey through the LEAPS framework. ${profile._sum.points} points earned across ${profile.submissions.filter(s => s.status === 'APPROVED').length} achievements.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${profile.name}'s LEAPS Journey`,
      description: `${profile.name} has earned ${profile._sum.points} points in the MS Elevate LEAPS program!`,
      url: canonicalUrl,
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${profile.name}'s LEAPS Journey`,
      description: `${profile.name} has earned ${profile._sum.points} points in the MS Elevate LEAPS program!`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  }
}

export default async function PublicProfile({ params }: ProfilePageProps) {
  const { handle } = await params
  
  return (
    <Suspense fallback={<PageLoading />}>
      <ProfileContent handle={handle} />
    </Suspense>
  )
}

