import { z } from 'zod'

import { getApiClient } from './api-client'

// Shared helpers
const envelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ success: z.literal(true), data: dataSchema })

// Common small schemas
const PaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  pages: z.number().int(),
})

const ActivitySchema = z.object({
  code: z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']),
  name: z.string(),
  default_points: z.number().int().optional(),
})

const UserMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  email: z.string().email().optional(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
})

const SubmissionSchema = z.object({
  id: z.string(),
  created_at: z.coerce.string(),
  updated_at: z.coerce.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  review_note: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).optional(),
  user: UserMiniSchema,
  activity: ActivitySchema,
})

const UsersListItemSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  email: z.string(),
  avatar_url: z.string().nullable().optional(),
  role: z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  created_at: z.coerce.string(),
  _count: z.object({
    submissions: z.number().int(),
    ledger: z.number().int(),
    earned_badges: z.number().int(),
  }),
  totalPoints: z.number().int(),
})

const BadgeCriteriaSchema = z.object({
  type: z.enum(['points', 'submissions', 'activities', 'streak']),
  threshold: z.number(),
  activity_codes: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).optional(),
})

const BadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  criteria: BadgeCriteriaSchema,
  icon_url: z.string().url().optional(),
  _count: z.object({ earned_badges: z.number().int() }).partial().optional(),
  earned_badges: z
    .array(
      z.object({
        id: z.string(),
        user: z.object({ id: z.string(), name: z.string(), handle: z.string() }),
        earned_at: z.coerce.string(),
      })
    )
    .optional(),
})

// Enveloped responses
const SubmissionsListSchema = envelope(
  z.object({ submissions: z.array(SubmissionSchema), pagination: PaginationSchema })
)

const UsersListSchema = envelope(
  z.object({ users: z.array(UsersListItemSchema), pagination: PaginationSchema })
)

const BadgesListSchema = envelope(
  z.object({ badges: z.array(BadgeSchema) })
)

const AnalyticsSchema = envelope(
  z.object({
    overview: z.object({
      submissions: z.object({ total: z.number(), pending: z.number(), approved: z.number(), rejected: z.number(), approvalRate: z.number() }),
      users: z.object({ total: z.number(), active: z.number(), withSubmissions: z.number(), withBadges: z.number(), activationRate: z.number() }),
      points: z.object({ totalAwarded: z.number(), totalEntries: z.number(), avgPerEntry: z.number() }),
      badges: z.object({ totalBadges: z.number(), totalEarned: z.number(), uniqueEarners: z.number() }),
      reviews: z.object({ pendingReviews: z.number(), avgReviewTimeHours: z.number() }),
    }),
    distributions: z.object({
      submissionsByStatus: z.array(z.object({ status: z.string(), count: z.number() })),
      submissionsByActivity: z.array(z.object({ activity: z.string(), activityName: z.string().optional(), count: z.number() })),
      usersByRole: z.array(z.object({ role: z.string(), count: z.number() })),
      usersByCohort: z.array(z.object({ cohort: z.string().nullable(), count: z.number() })).optional(),
      pointsByActivity: z.array(z.object({ activity: z.string(), activityName: z.string().optional(), totalPoints: z.number(), entries: z.number() })),
      pointsDistribution: z.any().optional(),
    }),
    trends: z.object({
      submissionsByDate: z.array(z.object({ date: z.string(), total: z.number(), approved: z.number(), rejected: z.number(), pending: z.number() })),
      userRegistrationsByDate: z.array(z.object({ date: z.string(), count: z.number() })),
    }),
    recentActivity: z.object({
      submissions: z.array(z.any()),
      approvals: z.array(z.any()),
      users: z.array(z.any()),
    }),
    performance: z.object({ reviewers: z.array(z.any()), topBadges: z.array(z.any()) }),
  })
)

const KajabiSchema = envelope(
  z.object({
    events: z.array(
      z.object({
        id: z.string(),
        received_at: z.coerce.string(),
        processed_at: z.coerce.string().nullable(),
        user_match: z.string().nullable(),
        payload: z.record(z.unknown()),
      })
    ),
    stats: z.object({
      total_events: z.number(),
      processed_events: z.number(),
      matched_users: z.number(),
      unmatched_events: z.number(),
      points_awarded: z.number(),
    }),
  })
)

const CohortsSchema = envelope(z.object({ cohorts: z.array(z.string()) }))

// Input schemas for queries/mutations (client-side minimal)
export type SubmissionsQuery = {
  status?: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  activity?: 'ALL' | 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'
  userId?: string
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'updated_at' | 'status'
  sortOrder?: 'asc' | 'desc'
  search?: string
  cohort?: string
}

export type UsersQuery = {
  search?: string
  role?: 'ALL' | 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  cohort?: string
  page?: number
  limit?: number
  sortBy?: 'created_at' | 'name' | 'email'
  sortOrder?: 'asc' | 'desc'
}

export const adminClient = {
  async getCohorts() {
    const api = getApiClient()
    const res = await api.getAdminCohorts()
    return (res as any).data.cohorts
  },

  async getSubmissions(params: SubmissionsQuery = {}) {
    const api = getApiClient()
    const normalized: Record<string, unknown> = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== 'ALL' && v !== '') normalized[k] = v
      if (k === 'status' && v === 'ALL') normalized['status'] = 'ALL'
      if (k === 'activity' && v === 'ALL') normalized['activity'] = 'ALL'
    })
    const res = await api.getAdminSubmissions(normalized as any)
    return (res as any).data
  },

  async reviewSubmission(body: { submissionId: string; action: 'approve' | 'reject'; reviewNote?: string; pointAdjustment?: number }) {
    const api = getApiClient()
    return api.reviewSubmission(body as any)
  },

  async bulkReview(body: { submissionIds: string[]; action: 'approve' | 'reject'; reviewNote?: string }) {
    const api = getApiClient()
    return api.bulkReview(body as any)
  },

  async getSubmissionById(id: string) {
    const api = getApiClient()
    const res = await api.getAdminSubmissionById(id)
    return (res as any).data.submission
  },

  async getUsers(params: UsersQuery = {}) {
    const api = getApiClient()
    const normalized: Record<string, unknown> = {}
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== 'ALL' && v !== '') normalized[k] = v
      if (k === 'role' && v === 'ALL') normalized['role'] = 'ALL'
    })
    const res = await api.getAdminUsers(normalized as any)
    return (res as any).data
  },

  async updateUser(body: { userId: string; role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'; school?: string | null; cohort?: string | null; name?: string; handle?: string }) {
    const api = getApiClient()
    return api.updateAdminUser(body as any)
  },

  async bulkUpdateUsers(body: { userIds: string[]; role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN' }) {
    const api = getApiClient()
    return api.bulkUpdateAdminUsers(body as any)
  },

  async getBadges(includeStats = true) {
    const api = getApiClient()
    const res = await api.getAdminBadges(includeStats ? { includeStats: 'true' } : undefined)
    return (res as any).data
  },

  async createBadge(body: { code: string; name: string; description: string; criteria: unknown; icon_url?: string }) {
    const api = getApiClient()
    return api.createAdminBadge(body as any)
  },

  async updateBadge(body: { code: string; name?: string; description?: string; criteria?: unknown; icon_url?: string }) {
    const api = getApiClient()
    return api.updateAdminBadge(body as any)
  },

  async deleteBadge(code: string) {
    const api = getApiClient()
    return api.deleteAdminBadge(code)
  },

  async assignBadge(body: { badgeCode: string; userIds: string[]; reason?: string }) {
    const api = getApiClient()
    return api.assignAdminBadge(body as any)
  },

  async removeBadge(body: { badgeCode: string; userIds: string[]; reason?: string }) {
    const api = getApiClient()
    return api.removeAdminBadge(body as any)
  },

  async getAnalytics(params: { startDate?: string; endDate?: string; cohort?: string } = {}) {
    const api = getApiClient()
    const res = await api.getAdminAnalytics(params as any)
    return (res as any).data
  },

  async getKajabi() {
    const api = getApiClient()
    const res = await api.getAdminKajabi()
    return (res as any).data
  },

  async testKajabi(body: { user_email: string; course_name?: string }) {
    const api = getApiClient()
    return api.testAdminKajabi(body as any)
  },

  async reprocessKajabi(body: { event_id: string }) {
    const api = getApiClient()
    return api.reprocessAdminKajabi(body as any)
  },
}

export type { SubmissionSchema as AdminSubmissionSchema }
