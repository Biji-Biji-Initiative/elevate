// DTO layer to map Prisma models to clean API types
// This prevents ORM/Model leakage into public API surfaces

// Import domain types instead of Prisma types for pure type definitions
import type {
  SubmissionStatus,
  Visibility
} from './domain-constants.js';

// Prisma model interfaces needed for DTOs (duplicated to avoid runtime dependency)
export interface User {
  id: string;
  handle: string;
  name: string;
  email: string;
  role: string;
  school: string | null;
  cohort: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Submission {
  id: string;
  user_id: string;
  activity_code: string;
  status: SubmissionStatus;
  visibility: Visibility;
  payload: any;
  attachments: string[];
  reviewer_id: string | null;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Activity {
  code: string;
  name: string;
  description: string | null;
  default_points: number;
  requirements: any | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Badge {
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria: any | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface EarnedBadge {
  id: string;
  user_id: string;
  badge_code: string;
  earned_at: Date;
  created_at: Date;
}

// Clean DTOs with camelCase fields and no Prisma-specific patterns

export interface LeaderboardUserBadgeDTO {
  badge: {
    code: string;
    name: string;
    iconUrl?: string | null;
  };
}

export interface LeaderboardEntryDTO {
  rank: number;
  user: {
    id: string;
    handle: string;
    name: string;
    school?: string | null | undefined;
    avatarUrl?: string | null | undefined;
    earnedBadges?: LeaderboardUserBadgeDTO[] | undefined;
    totalPoints: number;
  };
}

export interface StageBreakdownDTO {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export interface StatsResponseDTO {
  totalEducators: number;
  totalSubmissions: number;
  totalPoints: number;
  studentsImpacted?: number;
  byStage: {
    learn: StageBreakdownDTO;
    explore: StageBreakdownDTO;
    amplify: StageBreakdownDTO;
    present: StageBreakdownDTO;
    shine: StageBreakdownDTO;
  };
  topCohorts: Array<{ name: string; count: number; avgPoints?: number }>;
  monthlyGrowth: Array<{ month: string; educators: number; submissions: number }>;
  badges: {
    totalAwarded: number;
    uniqueBadges: number;
    mostPopular: Array<{ code: string; name: string; count: number }>;
  };
}

export interface SubmissionDTO {
  id: string;
  activityCode: 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE';
  activity: { name: string; code: string };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  visibility: 'PUBLIC' | 'PRIVATE';
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileBadgeDTO {
  badge: { 
    code: string; 
    name: string; 
    description: string; 
    iconUrl?: string | null;
  };
  earnedAt: string;
}

export interface UserProfileDTO {
  id: string;
  handle: string;
  name: string;
  email: string;
  avatarUrl?: string | null | undefined;
  school?: string | null | undefined;
  cohort?: string | null | undefined;
  createdAt: string;
  submissions: SubmissionDTO[];
  earnedBadges: UserProfileBadgeDTO[];
  totalPoints: number;
}

export interface StageMetricsDTO {
  stage: string;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  avgPointsEarned: number;
  uniqueEducators: number;
  topSchools: Array<{ name: string; count: number }>;
  cohortBreakdown: Array<{ cohort: string; count: number }>;
  monthlyTrend: Array<{ month: string; submissions: number; approvals: number }>;
  completionRate: number;
}

// Mapper functions from Prisma models to DTOs

export function mapLeaderboardUserBadgeToDTO(
  earnedBadge: EarnedBadge & { badge: Badge }
): LeaderboardUserBadgeDTO {
  return {
    badge: {
      code: earnedBadge.badge.code,
      name: earnedBadge.badge.name,
      iconUrl: earnedBadge.badge.icon_url,
    },
  };
}

export function mapLeaderboardEntryToDTO(
  rank: number,
  user: User & { 
    earned_badges?: (EarnedBadge & { badge: Badge })[]; 
  },
  totalPoints: number
): LeaderboardEntryDTO {
  return {
    rank,
    user: {
      id: user.id,
      handle: user.handle,
      name: user.name,
      school: user.school ?? undefined,
      avatarUrl: user.avatar_url ?? undefined,
      earnedBadges: user.earned_badges?.map(mapLeaderboardUserBadgeToDTO) || undefined,
      totalPoints,
    },
  };
}

export function mapSubmissionToDTO(
  submission: Submission & { activity: Activity }
): SubmissionDTO {
  return {
    id: submission.id,
    activityCode: submission.activity_code as 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE',
    activity: {
      name: submission.activity.name,
      code: submission.activity.code,
    },
    status: submission.status,
    visibility: submission.visibility,
    payload: submission.payload as Record<string, unknown>,
    createdAt: submission.created_at.toISOString(),
    updatedAt: submission.updated_at.toISOString(),
  };
}

export function mapUserProfileBadgeToDTO(
  earnedBadge: EarnedBadge & { badge: Badge }
): UserProfileBadgeDTO {
  return {
    badge: {
      code: earnedBadge.badge.code,
      name: earnedBadge.badge.name,
      description: earnedBadge.badge.description,
      iconUrl: earnedBadge.badge.icon_url,
    },
    earnedAt: earnedBadge.earned_at.toISOString(),
  };
}

export function mapUserProfileToDTO(
  user: User & {
    submissions: (Submission & { activity: Activity })[];
    earned_badges: (EarnedBadge & { badge: Badge })[];
  },
  totalPoints: number
): UserProfileDTO {
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    school: user.school,
    cohort: user.cohort,
    createdAt: user.created_at.toISOString(),
    submissions: user.submissions.map(mapSubmissionToDTO),
    earnedBadges: user.earned_badges.map(mapUserProfileBadgeToDTO),
    totalPoints,
  };
}

// Helper type for raw aggregation results from Prisma
export interface PrismaAggregationResult {
  _sum?: { points?: number | null } | null;
}

// Helper to safely extract points from Prisma aggregation
export function extractPointsFromAggregation(
  aggregation: PrismaAggregationResult | null | undefined
): number {
  return aggregation?._sum?.points ?? 0;
}

// Helper to map raw leaderboard data from API routes to DTO
export function mapRawLeaderboardEntryToDTO(
  rank: number,
  rawUser: {
    id: string;
    handle: string;
    name: string;
    avatar_url: string | null;
    school: string | null;
    earned_badges: Array<{
      badge: {
        code: string;
        name: string;
        icon_url: string | null;
      };
    }>;
    _sum: {
      points: number;
    };
  }
): LeaderboardEntryDTO {
  return {
    rank,
    user: {
      id: rawUser.id,
      handle: rawUser.handle,
      name: rawUser.name,
      school: rawUser.school,
      avatarUrl: rawUser.avatar_url,
      earnedBadges: rawUser.earned_badges?.map(badge => ({
        badge: {
          code: badge.badge.code,
          name: badge.badge.name,
          iconUrl: badge.badge.icon_url,
        },
      })),
      totalPoints: rawUser._sum.points,
    },
  };
}

// Helper to map raw profile data from API routes to DTO
export function mapRawUserProfileToDTO(
  rawUser: {
    id: string;
    handle: string;
    name: string;
    school?: string | null;
    cohort?: string | null;
    created_at: Date | string;
    _sum: { points: number };
    earned_badges: Array<{
      badge_code?: string;
      badge: {
        code: string;
        name: string;
        description: string;
        icon_url?: string | null;
      };
      earned_at: Date | string;
    }>;
    submissions: Array<{
      id: string;
      activity_code: string;
      activity: { name: string; code: string };
      status: string;
      visibility: string;
      payload: any;
      created_at: Date | string;
      updated_at: Date | string;
    }>;
  }
): UserProfileDTO {
  return {
    id: rawUser.id,
    handle: rawUser.handle,
    name: rawUser.name,
    email: '', // Email not exposed in profile API
    avatarUrl: null, // Avatar not included in current profile
    school: rawUser.school ?? undefined,
    cohort: rawUser.cohort ?? undefined,
    createdAt: typeof rawUser.created_at === 'string' 
      ? rawUser.created_at 
      : rawUser.created_at.toISOString(),
    submissions: rawUser.submissions.map(sub => ({
      id: sub.id,
      activityCode: sub.activity_code as 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE',
      activity: sub.activity,
      status: sub.status as 'PENDING' | 'APPROVED' | 'REJECTED',
      visibility: sub.visibility as 'PUBLIC' | 'PRIVATE',
      payload: sub.payload as Record<string, unknown>,
      createdAt: typeof sub.created_at === 'string' 
        ? sub.created_at 
        : sub.created_at.toISOString(),
      updatedAt: typeof sub.updated_at === 'string' 
        ? sub.updated_at 
        : sub.updated_at.toISOString(),
    })),
    earnedBadges: rawUser.earned_badges.map(badge => ({
      badge: {
        code: badge.badge.code,
        name: badge.badge.name,
        description: badge.badge.description,
        iconUrl: badge.badge.icon_url || null,
      },
      earnedAt: typeof badge.earned_at === 'string' 
        ? badge.earned_at 
        : badge.earned_at.toISOString(),
    })),
    totalPoints: rawUser._sum.points,
  };
}