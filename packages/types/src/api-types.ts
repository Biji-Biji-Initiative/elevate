// Shared API types used across web and admin
// TODO: Migrate to clean DTOs from dto-mappers.ts to eliminate ORM/Model leakage

// DEPRECATED: Legacy types with ORM leakage (Prisma _sum, snake_case)
// These maintain backward compatibility but should be migrated to DTOs

export interface LeaderboardUserBadge {
  badge: {
    code: string
    name: string
    icon_url?: string | null  // snake_case - ORM leakage
  }
}

export interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    handle: string
    name: string
    school?: string | null
    avatar_url?: string | null  // snake_case - ORM leakage
    earned_badges?: LeaderboardUserBadge[]  // snake_case - ORM leakage
    _sum?: { points: number }  // Prisma aggregation pattern - ORM leakage
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
  activity_code: 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'  // snake_case - ORM leakage
  activity: { name: string; code: string }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  visibility: 'PUBLIC' | 'PRIVATE'
  payload: Record<string, unknown>
  created_at: string  // snake_case - ORM leakage
  updated_at: string  // snake_case - ORM leakage
}

export interface UserProfileBadge {
  badge: { code: string; name: string; description: string; icon_url?: string | null }  // snake_case - ORM leakage
  earned_at: string  // snake_case - ORM leakage
}

export interface UserProfileResponse {
  id: string
  handle: string
  name: string
  email: string
  avatar_url?: string | null  // snake_case - ORM leakage
  school?: string | null
  cohort?: string | null
  created_at: string  // snake_case - ORM leakage
  submissions: UserProfileSubmission[]
  earned_badges: UserProfileBadge[]  // snake_case - ORM leakage
  _sum: { points: number }  // Prisma aggregation pattern - ORM leakage
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

// Re-export clean DTOs for new code
// Use these instead of the legacy types above
export type {
  LeaderboardEntryDTO,
  LeaderboardUserBadgeDTO,
  StageBreakdownDTO,
  StatsResponseDTO,
  SubmissionDTO,
  UserProfileBadgeDTO,
  UserProfileDTO,
  StageMetricsDTO
} from './dto-mappers.js';

// Compatibility helpers for migrating from legacy to DTO
export {
  mapRawLeaderboardEntryToDTO,
  mapRawUserProfileToDTO,
  extractPointsFromAggregation
} from './dto-mappers.js';