// DTO layer to map Prisma models to clean API types
// This prevents ORM/Model leakage into public API surfaces

// Import domain types instead of Prisma types for pure type definitions
import { z } from 'zod'

import {
  ACTIVITY_CODES,
  type SubmissionStatus,
  type Visibility,
} from './domain-constants'
import {
  LearnSchema,
  ExploreSchema,
  AmplifySchema,
  PresentSchema,
  ShineSchema,
} from './schemas'
import {
  LearnApiSchema,
  ExploreApiSchema,
  AmplifyApiSchema,
  PresentApiSchema,
  ShineApiSchema,
} from './submission-payloads.api'

// Prisma model interfaces needed for DTOs (aligned with actual schema)
export interface User {
  id: string
  handle: string
  name: string
  email: string
  role: string
  school: string | null
  cohort: string | null
  avatar_url: string | null
  kajabi_contact_id: string | null
  created_at: Date
}

export interface Submission {
  id: string
  user_id: string
  activity_code: string
  status: SubmissionStatus
  visibility: Visibility
  payload: unknown
  reviewer_id: string | null
  review_note: string | null
  created_at: Date
  updated_at: Date
}

export interface Activity {
  code: string
  name: string
  default_points: number
}

export interface Badge {
  code: string
  name: string
  description: string
  icon_url: string | null
  criteria: unknown
}

export interface EarnedBadge {
  id: string
  user_id: string
  badge_code: string
  earned_at: Date
}

// Clean DTOs with camelCase fields and no Prisma-specific patterns

// Admin Analytics DTOs for admin dashboard responses
export const AdminAnalyticsDTOSchema = z.object({
  overview: z.object({
    submissions: z.object({
      total: z.number(),
      pending: z.number(),
      approved: z.number(),
      rejected: z.number(),
      approvalRate: z.number(),
    }),
    users: z.object({
      total: z.number(),
      active: z.number(),
      withSubmissions: z.number(),
      withBadges: z.number(),
      activationRate: z.number(),
    }),
    points: z.object({
      totalAwarded: z.number(),
      totalEntries: z.number(),
      avgPerEntry: z.number(),
    }),
    badges: z.object({
      totalBadges: z.number(),
      totalEarned: z.number(),
      uniqueEarners: z.number(),
    }),
    reviews: z.object({
      pendingReviews: z.number(),
      avgReviewTimeHours: z.number(),
    }),
  }),
  distributions: z.object({
    submissionsByStatus: z.array(
      z.object({ status: z.string(), count: z.number() }),
    ),
    submissionsByActivity: z.array(
      z.object({
        activity: z.string(),
        activityName: z.string().optional(),
        count: z.number(),
      }),
    ),
    usersByRole: z.array(z.object({ role: z.string(), count: z.number() })),
    usersByCohort: z
      .array(z.object({ cohort: z.string().nullable(), count: z.number() }))
      .optional(),
    pointsByActivity: z.array(
      z.object({
        activity: z.string(),
        activityName: z.string().optional(),
        totalPoints: z.number(),
        entries: z.number(),
      }),
    ),
    pointsDistribution: z
      .object({
        totalUsers: z.number(),
        max: z.number(),
        min: z.number(),
        avg: z.number(),
        percentiles: z.array(
          z.object({ percentile: z.number(), value: z.number() }),
        ),
      })
      .optional(),
  }),
  trends: z.object({
    submissionsByDate: z.array(
      z.object({
        date: z.string(),
        total: z.number(),
        approved: z.number(),
        rejected: z.number(),
        pending: z.number(),
      }),
    ),
    userRegistrationsByDate: z.array(
      z.object({ date: z.string(), count: z.number() }),
    ),
  }),
  recentActivity: z.object({
    submissions: z.array(
      z.object({
        id: z.string(),
        user: z.object({ name: z.string(), handle: z.string() }),
        activity: z.object({ name: z.string() }),
        status: z.string(),
        created_at: z.string(),
      }),
    ),
    approvals: z.array(
      z.object({
        id: z.string(),
        user: z.object({ name: z.string(), handle: z.string() }),
        activity: z.object({ name: z.string() }),
        updated_at: z.string(),
      }),
    ),
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        handle: z.string(),
        email: z.string(),
        role: z.string(),
        created_at: z.string(),
      }),
    ),
  }),
  performance: z.object({
    reviewers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        handle: z.string(),
        role: z.string(),
        approved: z.number(),
        rejected: z.number(),
        total: z.number(),
      }),
    ),
    topBadges: z.array(
      z.object({
        badge: z
          .object({
            code: z.string().optional(),
            name: z.string().optional(),
            icon_url: z.string().nullable().optional(),
          })
          .passthrough(),
        earnedCount: z.number(),
      }),
    ),
  }),
})

export type AdminAnalyticsDTO = z.infer<typeof AdminAnalyticsDTOSchema>

export interface LeaderboardUserBadgeDTO {
  badge: {
    code: string
    name: string
    iconUrl?: string | null
  }
}

export interface LeaderboardEntryDTO {
  rank: number
  user: {
    id: string
    handle: string
    name: string
    school?: string | null | undefined
    avatarUrl?: string | null | undefined
    earnedBadges?: LeaderboardUserBadgeDTO[] | undefined
    totalPoints: number
  }
}

export interface StageBreakdownDTO {
  total: number
  approved: number
  pending: number
  rejected: number
}

export const StageBreakdownDTOSchema = z.object({
  total: z.number(),
  approved: z.number(),
  pending: z.number(),
  rejected: z.number(),
})

export const StatsResponseDTOSchema = z.object({
  totalEducators: z.number(),
  totalSubmissions: z.number(),
  totalPoints: z.number(),
  studentsImpacted: z.number(),
  byStage: z.object({
    learn: StageBreakdownDTOSchema,
    explore: StageBreakdownDTOSchema,
    amplify: StageBreakdownDTOSchema,
    present: StageBreakdownDTOSchema,
    shine: StageBreakdownDTOSchema,
  }),
  topCohorts: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      avgPoints: z.number().optional(),
    }),
  ),
  monthlyGrowth: z.array(
    z.object({
      month: z.string(),
      educators: z.number(),
      submissions: z.number(),
    }),
  ),
  badges: z.object({
    totalAwarded: z.number(),
    uniqueBadges: z.number(),
    mostPopular: z.array(
      z.object({ code: z.string(), name: z.string(), count: z.number() }),
    ),
  }),
})

export type StatsResponseDTO = z.infer<typeof StatsResponseDTOSchema>

export interface SubmissionDTO {
  id: string
  activityCode: 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'
  activity: { name: string; code: string }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  visibility: 'PUBLIC' | 'PRIVATE'
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface UserProfileBadgeDTO {
  badge: {
    code: string
    name: string
    description: string | null
    iconUrl?: string | null
  }
  earnedAt: string
}

export interface UserProfileDTO {
  id: string
  handle: string
  name: string
  email: string
  avatarUrl?: string | null
  school?: string | null
  cohort?: string | null
  createdAt: string
  submissions: SubmissionDTO[]
  earnedBadges: UserProfileBadgeDTO[]
  totalPoints: number
}

export interface StageMetricsDTO {
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

// Mapper functions from Prisma models to DTOs

// Zod Schemas for DTOs (runtime validation)
export const LeaderboardUserBadgeDTOSchema = z.object({
  badge: z.object({
    code: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    iconUrl: z.string().nullable().optional(),
  }),
  earnedAt: z.string().optional(),
})

export const LeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  user: z.object({
    id: z.string(),
    handle: z.string(),
    name: z.string(),
    school: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    earnedBadges: z.array(LeaderboardUserBadgeDTOSchema).optional(),
    totalPoints: z.number(),
  }),
})

export const StageMetricsDTOSchema = z.object({
  stage: z.string(),
  totalSubmissions: z.number(),
  approvedSubmissions: z.number(),
  pendingSubmissions: z.number(),
  rejectedSubmissions: z.number(),
  avgPointsEarned: z.number(),
  uniqueEducators: z.number(),
  topSchools: z.array(z.object({ name: z.string(), count: z.number() })),
  cohortBreakdown: z.array(z.object({ cohort: z.string(), count: z.number() })),
  monthlyTrend: z.array(
    z.object({
      month: z.string(),
      submissions: z.number(),
      approvals: z.number(),
    }),
  ),
  completionRate: z.number(),
})

// Admin Users DTOs (for cleaned admin responses)
export interface AdminUserDTO {
  id: string
  handle: string
  name: string
  email: string
  avatarUrl?: string | null
  role: string
  school?: string | null
  cohort?: string | null
  createdAt: string
  counts: {
    submissions: number
    ledgerEntries: number
    earnedBadges: number
  }
  totalPoints: number
}

export const AdminUserDTOSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  role: z.string(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  createdAt: z.string(),
  counts: z.object({
    submissions: z.number(),
    ledgerEntries: z.number(),
    earnedBadges: z.number(),
  }),
  totalPoints: z.number(),
})

export function mapRawAdminUserToDTO(
  raw: {
    id: string
    handle: string
    name: string
    email: string
    avatar_url: string | null
    role: string
    school: string | null
    cohort: string | null
    created_at: Date
    _count: { submissions: number; ledger: number; earned_badges: number }
  },
  totalPoints: number,
): AdminUserDTO {
  return {
    id: raw.id,
    handle: raw.handle,
    name: raw.name,
    email: raw.email,
    avatarUrl: raw.avatar_url,
    role: raw.role,
    school: raw.school,
    cohort: raw.cohort,
    createdAt: raw.created_at.toISOString(),
    counts: {
      submissions: raw._count.submissions,
      ledgerEntries: raw._count.ledger,
      earnedBadges: raw._count.earned_badges,
    },
    totalPoints,
  }
}

export function mapLeaderboardUserBadgeToDTO(
  earnedBadge: EarnedBadge & { badge: Badge },
): LeaderboardUserBadgeDTO {
  return {
    badge: {
      code: earnedBadge.badge.code,
      name: earnedBadge.badge.name,
      iconUrl: earnedBadge.badge.icon_url,
    },
  }
}

export function mapLeaderboardEntryToDTO(
  rank: number,
  user: User & {
    earned_badges?: (EarnedBadge & { badge: Badge })[]
  },
  totalPoints: number,
): LeaderboardEntryDTO {
  return {
    rank,
    user: {
      id: user.id,
      handle: user.handle,
      name: user.name,
      school: user.school ?? undefined,
      avatarUrl: user.avatar_url ?? undefined,
      earnedBadges:
        user.earned_badges?.map(mapLeaderboardUserBadgeToDTO) || undefined,
      totalPoints,
    },
  }
}

export function mapSubmissionToDTO(
  submission: Submission & { activity: Activity },
): SubmissionDTO {
  return {
    id: submission.id,
    activityCode: submission.activity_code as
      | 'LEARN'
      | 'EXPLORE'
      | 'AMPLIFY'
      | 'PRESENT'
      | 'SHINE',
    activity: {
      name: submission.activity.name,
      code: submission.activity.code,
    },
    status: submission.status,
    visibility: submission.visibility,
    payload: submission.payload as Record<string, unknown>,
    createdAt: submission.created_at.toISOString(),
    updatedAt: submission.updated_at.toISOString(),
  }
}

export const SubmissionDTOSchema = z.object({
  id: z.string(),
  activityCode: z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']),
  activity: z.object({ name: z.string(), code: z.string() }),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  payload: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export function mapUserProfileBadgeToDTO(
  earnedBadge: EarnedBadge & { badge: Badge },
): UserProfileBadgeDTO {
  return {
    badge: {
      code: earnedBadge.badge.code,
      name: earnedBadge.badge.name,
      description: earnedBadge.badge.description,
      iconUrl: earnedBadge.badge.icon_url,
    },
    earnedAt: earnedBadge.earned_at.toISOString(),
  }
}

export function mapUserProfileToDTO(
  user: User & {
    submissions: (Submission & { activity: Activity })[]
    earned_badges: (EarnedBadge & { badge: Badge })[]
  },
  totalPoints: number,
): UserProfileDTO {
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    school: user.school ?? null,
    cohort: user.cohort ?? null,
    createdAt: user.created_at.toISOString(),
    submissions: user.submissions.map(mapSubmissionToDTO),
    earnedBadges: user.earned_badges.map(mapUserProfileBadgeToDTO),
    totalPoints,
  }
}

export const UserProfileBadgeDTOSchema = z.object({
  badge: z.object({
    code: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    iconUrl: z.string().nullable().optional(),
  }),
  earnedAt: z.string(),
})

export const UserProfileDTOSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  createdAt: z.string(),
  submissions: z.array(SubmissionDTOSchema),
  earnedBadges: z.array(UserProfileBadgeDTOSchema),
  totalPoints: z.number(),
})

// Helper type for raw aggregation results from Prisma
export interface PrismaAggregationResult {
  _sum?: { points?: number | null } | null
}

// Helper to safely extract points from Prisma aggregation
export function extractPointsFromAggregation(
  aggregation: PrismaAggregationResult | null | undefined,
): number {
  return aggregation?._sum?.points ?? 0
}

// Helper to map raw leaderboard data from API routes to DTO
export function mapRawLeaderboardEntryToDTO(
  rank: number,
  rawUser: {
    id: string
    handle: string
    name: string
    avatar_url: string | null
    school: string | null
    earned_badges: Array<{
      badge: {
        code: string
        name: string
        icon_url: string | null
      }
    }>
    _sum: {
      points: number
    }
  },
): LeaderboardEntryDTO {
  return {
    rank,
    user: {
      id: rawUser.id,
      handle: rawUser.handle,
      name: rawUser.name,
      school: rawUser.school,
      avatarUrl: rawUser.avatar_url,
      earnedBadges: rawUser.earned_badges?.map((badge) => ({
        badge: {
          code: badge.badge.code,
          name: badge.badge.name,
          iconUrl: badge.badge.icon_url,
        },
      })),
      totalPoints: rawUser._sum.points,
    },
  }
}

// Helper to map raw profile data from API routes to DTO
export function mapRawUserProfileToDTO(rawUser: {
  id: string
  handle: string
  name: string
  school?: string | null
  cohort?: string | null
  created_at: Date | string
  _sum: { points: number }
  earned_badges: Array<{
    badge_code?: string
    badge: {
      code: string
      name: string
      description: string
      icon_url?: string | null
    }
    earned_at: Date | string
  }>
  submissions: Array<{
    id: string
    activity_code: string
    activity: { name: string; code: string }
    status: string
    visibility: string
    payload: Record<string, unknown>
    created_at: Date | string
    updated_at: Date | string
  }>
}): UserProfileDTO {
  return {
    id: rawUser.id,
    handle: rawUser.handle,
    name: rawUser.name,
    email: '', // Email not exposed in profile API
    avatarUrl: null, // Avatar not included in current profile
    school: rawUser.school ?? null,
    cohort: rawUser.cohort ?? null,
    createdAt:
      typeof rawUser.created_at === 'string'
        ? rawUser.created_at
        : rawUser.created_at.toISOString(),
    submissions: rawUser.submissions.map((sub) => ({
      id: sub.id,
      activityCode: sub.activity_code as
        | 'LEARN'
        | 'EXPLORE'
        | 'AMPLIFY'
        | 'PRESENT'
        | 'SHINE',
      activity: sub.activity,
      status: sub.status as 'PENDING' | 'APPROVED' | 'REJECTED',
      visibility: sub.visibility as 'PUBLIC' | 'PRIVATE',
      payload: sub.payload as Record<string, unknown>,
      createdAt:
        typeof sub.created_at === 'string'
          ? sub.created_at
          : sub.created_at.toISOString(),
      updatedAt:
        typeof sub.updated_at === 'string'
          ? sub.updated_at
          : sub.updated_at.toISOString(),
    })),
    earnedBadges: rawUser.earned_badges.map((badge) => ({
      badge: {
        code: badge.badge.code,
        name: badge.badge.name,
        description: badge.badge.description,
        iconUrl: badge.badge.icon_url || null,
      },
      earnedAt:
        typeof badge.earned_at === 'string'
          ? badge.earned_at
          : badge.earned_at.toISOString(),
    })),
    totalPoints: rawUser._sum.points,
  }
}

// COMPREHENSIVE PAYLOAD TRANSFORMATION LAYER
// Transforms between snake_case (DB storage) and camelCase (API interface)

// API-friendly payload interfaces (camelCase for client consumption)
export interface LearnPayloadAPI {
  provider: 'SPL' | 'ILS'
  courseName: string
  certificateUrl?: string
  certificateHash?: string
  completedAt: string
}

export interface ExplorePayloadAPI {
  reflection: string
  classDate: string
  school?: string
  evidenceFiles?: string[]
}

export interface AmplifyPayloadAPI {
  peersTrained: number
  studentsTrained: number
  attendanceProofFiles?: string[]
}

export interface PresentPayloadAPI {
  linkedinUrl: string
  screenshotUrl?: string
  caption: string
}

export interface ShinePayloadAPI {
  ideaTitle: string
  ideaSummary: string
  attachments?: string[]
}

// Database storage payload interfaces (snake_case - matches Prisma schema)
export interface LearnPayloadDB {
  provider: 'SPL' | 'ILS'
  course_name: string
  certificate_url?: string
  certificate_hash?: string
  completed_at: string
}

export interface ExplorePayloadDB {
  reflection: string
  class_date: string
  school?: string
  evidence_files?: string[]
}

export interface AmplifyPayloadDB {
  peers_trained: number
  students_trained: number
  attendance_proof_files?: string[]
}

export interface PresentPayloadDB {
  linkedin_url: string
  screenshot_url?: string
  caption: string
}

export interface ShinePayloadDB {
  idea_title: string
  idea_summary: string
  attachments?: string[]
}

// Transformation functions: API (camelCase) -> DB (snake_case)
export function transformLearnAPIToDB(
  payload: LearnPayloadAPI,
): LearnPayloadDB {
  const result: LearnPayloadDB = {
    provider: payload.provider,
    course_name: payload.courseName,
    completed_at: payload.completedAt,
  }
  if (payload.certificateUrl !== undefined) {
    result.certificate_url = payload.certificateUrl
  }
  if (payload.certificateHash !== undefined) {
    result.certificate_hash = payload.certificateHash
  }
  return result
}

export function transformExploreAPIToDB(
  payload: ExplorePayloadAPI,
): ExplorePayloadDB {
  const result: ExplorePayloadDB = {
    reflection: payload.reflection,
    class_date: payload.classDate,
  }
  if (payload.school !== undefined) {
    result.school = payload.school
  }
  if (payload.evidenceFiles !== undefined) {
    result.evidence_files = payload.evidenceFiles
  }
  return result
}

export function transformAmplifyAPIToDB(
  payload: AmplifyPayloadAPI,
): AmplifyPayloadDB {
  const result: AmplifyPayloadDB = {
    peers_trained: payload.peersTrained,
    students_trained: payload.studentsTrained,
  }
  if (payload.attendanceProofFiles !== undefined) {
    result.attendance_proof_files = payload.attendanceProofFiles
  }
  return result
}

export function transformPresentAPIToDB(
  payload: PresentPayloadAPI,
): PresentPayloadDB {
  const result: PresentPayloadDB = {
    linkedin_url: payload.linkedinUrl,
    caption: payload.caption,
  }
  if (payload.screenshotUrl !== undefined) {
    result.screenshot_url = payload.screenshotUrl
  }
  return result
}

export function transformShineAPIToDB(
  payload: ShinePayloadAPI,
): ShinePayloadDB {
  const result: ShinePayloadDB = {
    idea_title: payload.ideaTitle,
    idea_summary: payload.ideaSummary,
  }
  if (payload.attachments !== undefined) {
    result.attachments = payload.attachments
  }
  return result
}

// Transformation functions: DB (snake_case) -> API (camelCase)
export function transformLearnDBToAPI(
  payload: LearnPayloadDB,
): LearnPayloadAPI {
  const result: LearnPayloadAPI = {
    provider: payload.provider,
    courseName: payload.course_name,
    completedAt: payload.completed_at,
  }
  if (payload.certificate_url !== undefined) {
    result.certificateUrl = payload.certificate_url
  }
  if (payload.certificate_hash !== undefined) {
    result.certificateHash = payload.certificate_hash
  }
  return result
}

export function transformExploreDBToAPI(
  payload: ExplorePayloadDB,
): ExplorePayloadAPI {
  const result: ExplorePayloadAPI = {
    reflection: payload.reflection,
    classDate: payload.class_date,
  }
  if (payload.school !== undefined) {
    result.school = payload.school
  }
  if (payload.evidence_files !== undefined) {
    result.evidenceFiles = payload.evidence_files
  }
  return result
}

export function transformAmplifyDBToAPI(
  payload: AmplifyPayloadDB,
): AmplifyPayloadAPI {
  const result: AmplifyPayloadAPI = {
    peersTrained: payload.peers_trained,
    studentsTrained: payload.students_trained,
  }
  if (payload.attendance_proof_files !== undefined) {
    result.attendanceProofFiles = payload.attendance_proof_files
  }
  return result
}

export function transformPresentDBToAPI(
  payload: PresentPayloadDB,
): PresentPayloadAPI {
  const result: PresentPayloadAPI = {
    linkedinUrl: payload.linkedin_url,
    caption: payload.caption,
  }
  if (payload.screenshot_url !== undefined) {
    result.screenshotUrl = payload.screenshot_url
  }
  return result
}

export function transformShineDBToAPI(
  payload: ShinePayloadDB,
): ShinePayloadAPI {
  const result: ShinePayloadAPI = {
    ideaTitle: payload.idea_title,
    ideaSummary: payload.idea_summary,
  }
  if (payload.attachments !== undefined) {
    result.attachments = payload.attachments
  }
  return result
}

// Generic payload transformation functions
export function transformPayloadAPIToDB(
  activityCode: string,
  payload: Record<string, unknown>,
):
  | LearnPayloadDB
  | ExplorePayloadDB
  | AmplifyPayloadDB
  | PresentPayloadDB
  | ShinePayloadDB {
  switch (activityCode) {
    case ACTIVITY_CODES[0]: {
      // LEARN
      const parsed = LearnApiSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid LEARN payload shape')
      const cleanedData: LearnPayloadAPI = {
        provider: parsed.data.provider,
        courseName: parsed.data.courseName,
        completedAt: parsed.data.completedAt,
        ...(parsed.data.certificateUrl !== undefined && {
          certificateUrl: parsed.data.certificateUrl,
        }),
        ...(parsed.data.certificateHash !== undefined && {
          certificateHash: parsed.data.certificateHash,
        }),
      }
      return transformLearnAPIToDB(cleanedData)
    }
    case ACTIVITY_CODES[1]: {
      // EXPLORE
      const parsed = ExploreApiSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid EXPLORE payload shape')
      const cleanedData: ExplorePayloadAPI = {
        reflection: parsed.data.reflection,
        classDate: parsed.data.classDate,
        ...(parsed.data.school !== undefined && { school: parsed.data.school }),
        ...(parsed.data.evidenceFiles !== undefined && {
          evidenceFiles: parsed.data.evidenceFiles,
        }),
      }
      return transformExploreAPIToDB(cleanedData)
    }
    case ACTIVITY_CODES[2]: {
      // AMPLIFY
      const parsed = AmplifyApiSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid AMPLIFY payload shape')
      const cleanedData: AmplifyPayloadAPI = {
        peersTrained: parsed.data.peersTrained,
        studentsTrained: parsed.data.studentsTrained,
        ...(parsed.data.attendanceProofFiles !== undefined && {
          attendanceProofFiles: parsed.data.attendanceProofFiles,
        }),
      }
      return transformAmplifyAPIToDB(cleanedData)
    }
    case ACTIVITY_CODES[3]: {
      // PRESENT
      const parsed = PresentApiSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid PRESENT payload shape')
      const cleanedData: PresentPayloadAPI = {
        linkedinUrl: parsed.data.linkedinUrl,
        caption: parsed.data.caption,
        ...(parsed.data.screenshotUrl !== undefined && {
          screenshotUrl: parsed.data.screenshotUrl,
        }),
      }
      return transformPresentAPIToDB(cleanedData)
    }
    case ACTIVITY_CODES[4]: {
      // SHINE
      const parsed = ShineApiSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid SHINE payload shape')
      const cleanedData: ShinePayloadAPI = {
        ideaTitle: parsed.data.ideaTitle,
        ideaSummary: parsed.data.ideaSummary,
        ...(parsed.data.attachments !== undefined && {
          attachments: parsed.data.attachments,
        }),
      }
      return transformShineAPIToDB(cleanedData)
    }
    default:
      throw new Error(`Unknown activity code: ${activityCode}`)
  }
}

export function transformPayloadDBToAPI(
  activityCode: string,
  payload: Record<string, unknown>,
):
  | LearnPayloadAPI
  | ExplorePayloadAPI
  | AmplifyPayloadAPI
  | PresentPayloadAPI
  | ShinePayloadAPI {
  switch (activityCode) {
    case ACTIVITY_CODES[0]: {
      // LEARN
      const parsed = LearnSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid LEARN DB payload shape')
      const cleanedData: LearnPayloadDB = {
        provider: parsed.data.provider,
        course_name: parsed.data.course_name,
        completed_at: parsed.data.completed_at,
        ...(parsed.data.certificate_url !== undefined && {
          certificate_url: parsed.data.certificate_url,
        }),
        ...(parsed.data.certificate_hash !== undefined && {
          certificate_hash: parsed.data.certificate_hash,
        }),
      }
      return transformLearnDBToAPI(cleanedData)
    }
    case ACTIVITY_CODES[1]: {
      // EXPLORE
      const parsed = ExploreSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid EXPLORE DB payload shape')
      const cleanedData: ExplorePayloadDB = {
        reflection: parsed.data.reflection,
        class_date: parsed.data.class_date,
        ...(parsed.data.school !== undefined && { school: parsed.data.school }),
        ...(parsed.data.evidence_files !== undefined && {
          evidence_files: parsed.data.evidence_files,
        }),
      }
      return transformExploreDBToAPI(cleanedData)
    }
    case ACTIVITY_CODES[2]: {
      // AMPLIFY
      const parsed = AmplifySchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid AMPLIFY DB payload shape')
      const cleanedData: AmplifyPayloadDB = {
        peers_trained: parsed.data.peers_trained,
        students_trained: parsed.data.students_trained,
        ...(parsed.data.attendance_proof_files !== undefined && {
          attendance_proof_files: parsed.data.attendance_proof_files,
        }),
      }
      return transformAmplifyDBToAPI(cleanedData)
    }
    case ACTIVITY_CODES[3]: {
      // PRESENT
      const parsed = PresentSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid PRESENT DB payload shape')
      const cleanedData: PresentPayloadDB = {
        linkedin_url: parsed.data.linkedin_url,
        caption: parsed.data.caption,
        ...(parsed.data.screenshot_url !== undefined && {
          screenshot_url: parsed.data.screenshot_url,
        }),
      }
      return transformPresentDBToAPI(cleanedData)
    }
    case ACTIVITY_CODES[4]: {
      // SHINE
      const parsed = ShineSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid SHINE DB payload shape')
      const cleanedData: ShinePayloadDB = {
        idea_title: parsed.data.idea_title,
        idea_summary: parsed.data.idea_summary,
        ...(parsed.data.attachments !== undefined && {
          attachments: parsed.data.attachments,
        }),
      }
      return transformShineDBToAPI(cleanedData)
    }
    default:
      throw new Error(`Unknown activity code: ${activityCode}`)
  }
}
