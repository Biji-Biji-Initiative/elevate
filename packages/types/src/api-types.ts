// Shared API types used across web and admin

export interface LeaderboardUserBadge {
  badge: {
    code: string
    name: string
    icon_url?: string | null
  }
}

export interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    handle: string
    name: string
    school?: string | null
    avatar_url?: string | null
    earned_badges?: LeaderboardUserBadge[]
    _sum?: { points: number }
    points?: number
  }
}

export interface StageBreakdown {
  total: number
  approved: number
  pending: number
  rejected: number
}

export interface StatsResponse {
  totalEducators: number
  totalSubmissions: number
  totalPoints: number
  studentsImpacted?: number
  byStage: {
    learn: StageBreakdown
    explore: StageBreakdown
    amplify: StageBreakdown
    present: StageBreakdown
    shine: StageBreakdown
  }
  topCohorts: Array<{ name: string; count: number; avgPoints?: number }>
  monthlyGrowth: Array<{ month: string; educators: number; submissions: number }>
  badges: {
    totalAwarded: number
    uniqueBadges: number
    mostPopular: Array<{ code: string; name: string; count: number }>
  }
}

export interface UserProfileSubmission {
  id: string
  activity_code: 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'
  activity: { name: string; code: string }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  visibility: 'PUBLIC' | 'PRIVATE'
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserProfileBadge {
  badge: { code: string; name: string; description: string; icon_url?: string | null }
  earned_at: string
}

export interface UserProfileResponse {
  id: string
  handle: string
  name: string
  email: string
  avatar_url?: string | null
  school?: string | null
  cohort?: string | null
  created_at: string
  submissions: UserProfileSubmission[]
  earned_badges: UserProfileBadge[]
  _sum: { points: number }
}

export interface StageMetricsResponse {
  stage: string
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgPointsEarned: number
  uniqueEducators: number
  topSchools: Array<{ name: string; count: number }>
  cohortBreakdown: Array<{ cohort: string; count: number }>
  monthlyTrend: Array<{ month: string; submissions: number; approvals: number }>
  completionRate: number
}

