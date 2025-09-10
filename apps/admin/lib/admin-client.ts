import { z } from 'zod'

import ElevateAPIClient, { type paths } from '@elevate/openapi/sdk'
import {
  SubmissionsListResponseSchema,
  UsersListResponseSchema,
  BadgesListResponseSchema,
  AnalyticsResponseSchema,
  KajabiResponseSchema,
  CohortsResponseSchema,
  ReviewResponseSchema,
  BulkReviewResponseSchema,
  UpdateUserResponseSchema,
  BulkUpdateUsersResponseSchema,
  KajabiTestResponseSchema,
  SubmissionsQuerySchema,
  UsersQuerySchema,
  AnalyticsQuerySchema,
  type AdminSubmission,
  type AdminUser,
  type AdminBadge,
  type KajabiEvent,
  type KajabiStats,
  type Pagination,
  type SubmissionsQuery,
  type UsersQuery,
  type AnalyticsQuery,
  type OverviewStats,
  type Distributions,
  type Trends,
  type RecentActivity,
  type Performance,
} from '@elevate/types/admin-api-types'
import {
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  UpdateUserSchema,
  BulkUpdateUsersSchema,
  AssignBadgeSchema,
  KajabiTestSchema,
  KajabiReprocessSchema,
} from '@elevate/types/admin-schemas'

// Local schema for badge create/update
const CreateBadgeSchema = z
  .object({ code: z.string(), name: z.string(), description: z.string() })
  .passthrough()
const UpdateBadgeSchema = z.object({ code: z.string() }).passthrough()

// Client error for admin UI
export class AdminClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AdminClientError'
  }
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return ''
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return ''
}

function getApiClient() {
  return new ElevateAPIClient({ baseUrl: getBaseUrl() })
}

type ExtractData<S extends z.ZodTypeAny> = z.output<S> extends { data: infer D }
  ? D
  : never

function extract<S extends z.ZodTypeAny>(
  response: unknown,
  schema: S,
  ctx: string,
): ExtractData<S> {
  try {
    const parsed = schema.parse(response) as z.output<S>
    // Avoid `any`: assert presence of `data` per response schemas
    return (parsed as { data: ExtractData<S> }).data
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdminClientError(
        `Invalid response in ${ctx}: ${error.message}`,
        error,
      )
    }
    throw new AdminClientError(`Unexpected error in ${ctx}`, error)
  }
}

function cleanParams<T extends Record<string, unknown>>(params: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      out[k] = v
    }
  }
  return out as T
}

export type AdminClient = {
  getCohorts(): Promise<string[]>
  getSubmissions(
    params?: SubmissionsQuery,
  ): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }>
  reviewSubmission(body: unknown): Promise<unknown>
  bulkReview(body: unknown): Promise<unknown>
  getUsers(
    params?: UsersQuery,
  ): Promise<{ users: AdminUser[]; pagination: Pagination }>
  updateUser(body: unknown): Promise<unknown>
  bulkUpdateUsers(body: unknown): Promise<unknown>
  getBadges(_includeCounts?: boolean): Promise<{ badges: AdminBadge[] }>
  createBadge(body: unknown): Promise<{ badges: AdminBadge[] }>
  updateBadge(body: unknown): Promise<{ badges: AdminBadge[] }>
  deleteBadge(code: string): Promise<{ badges: AdminBadge[] }>
  assignBadge(body: unknown): Promise<{ badges: AdminBadge[] }>
  getAnalytics(params?: AnalyticsQuery): Promise<{
    overview: OverviewStats
    distributions: Distributions
    trends: Trends
    recentActivity: RecentActivity
    performance: Performance
  }>
  getKajabi(): Promise<{ events: KajabiEvent[]; stats: KajabiStats }>
  testKajabi(body: unknown): Promise<unknown>
  reprocessKajabi(body: unknown): Promise<unknown>
}

export const adminClient: AdminClient = {
  async getCohorts(): Promise<string[]> {
    const api = getApiClient()
    const res = await api.getAdminCohorts()
    return extract(res, CohortsResponseSchema, 'getCohorts').cohorts
  },

  async getSubmissions(
    params: SubmissionsQuery = {},
  ): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }> {
    const validated = SubmissionsQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminSubmissions(
      cleanParams(
        validated,
      ) as paths['/api/admin/submissions']['get']['parameters']['query'],
    )
    return extract(res, SubmissionsListResponseSchema, 'getSubmissions')
  },

  async reviewSubmission(body: unknown) {
    const api = getApiClient()
    const req = ReviewSubmissionSchema.parse(body)
    type ReviewBody = NonNullable<
      paths['/api/admin/submissions']['patch']['requestBody']
    >['content']['application/json']
    const apiBody: ReviewBody = {
      submissionId: req.submissionId,
      action: req.action,
      ...(req.reviewNote !== undefined ? { reviewNote: req.reviewNote } : {}),
      ...(req.pointAdjustment !== undefined
        ? { pointAdjustment: req.pointAdjustment }
        : {}),
    }
    const res = await api.reviewSubmission(apiBody)
    return extract(res, ReviewResponseSchema, 'reviewSubmission')
  },

  async bulkReview(body: unknown) {
    const api = getApiClient()
    const req = BulkReviewSubmissionsSchema.parse(body)
    type BulkReviewBody = NonNullable<
      paths['/api/admin/submissions']['post']['requestBody']
    >['content']['application/json']
    const apiBody: BulkReviewBody = {
      submissionIds: req.submissionIds,
      action: req.action,
      ...(req.reviewNote !== undefined ? { reviewNote: req.reviewNote } : {}),
    }
    const res = await api.bulkReview(apiBody)
    return extract(res, BulkReviewResponseSchema, 'bulkReview')
  },

  async getUsers(
    params: UsersQuery = {},
  ): Promise<{ users: AdminUser[]; pagination: Pagination }> {
    const validated = UsersQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminUsers(
      cleanParams(
        validated,
      ) as paths['/api/admin/users']['get']['parameters']['query'],
    )
    return extract(res, UsersListResponseSchema, 'getUsers')
  },

  async updateUser(body: unknown) {
    const api = getApiClient()
    const req = UpdateUserSchema.parse(body)
    type UpdateUserBody = NonNullable<
      paths['/api/admin/users']['patch']['requestBody']
    >['content']['application/json']
    const apiBody: UpdateUserBody = {
      userId: req.userId,
      ...(req.name !== undefined ? { name: req.name } : {}),
      ...(req.handle !== undefined ? { handle: req.handle } : {}),
      ...(req.school !== undefined ? { school: req.school } : {}),
      ...(req.cohort !== undefined ? { cohort: req.cohort } : {}),
      ...(req.role !== undefined ? { role: req.role } : {}),
    }
    const res = await api.updateAdminUser(apiBody)
    return extract(res, UpdateUserResponseSchema, 'updateUser')
  },

  async bulkUpdateUsers(body: unknown) {
    const api = getApiClient()
    const req = BulkUpdateUsersSchema.parse(body)
    type BulkUsersBody = NonNullable<
      paths['/api/admin/users']['post']['requestBody']
    >['content']['application/json']
    const apiBody: BulkUsersBody = {
      userIds: req.userIds,
      role: req.role,
    }
    const res = await api.bulkUpdateAdminUsers(apiBody)
    return extract(res, BulkUpdateUsersResponseSchema, 'bulkUpdateUsers')
  },

  async getBadges(_includeCounts?: boolean): Promise<{ badges: AdminBadge[] }> {
    const api = getApiClient()
    const res = await api.getAdminBadges()
    return extract(res, BadgesListResponseSchema, 'getBadges')
  },

  async createBadge(body: unknown) {
    const api = getApiClient()
    const req = CreateBadgeSchema.parse(body)
    const res = await api.createAdminBadge(req)
    return extract(res, BadgesListResponseSchema, 'createBadge')
  },

  async updateBadge(body: unknown) {
    const api = getApiClient()
    const req = UpdateBadgeSchema.parse(body)
    const res = await api.updateAdminBadge(req)
    return extract(res, BadgesListResponseSchema, 'updateBadge')
  },

  async deleteBadge(code: string) {
    const api = getApiClient()
    const res = await api.deleteAdminBadge(code)
    return extract(res, BadgesListResponseSchema, 'deleteBadge')
  },

  async assignBadge(body: unknown) {
    const api = getApiClient()
    const req = AssignBadgeSchema.parse(body)
    type AssignBody = NonNullable<
      paths['/api/admin/badges/assign']['post']['requestBody']
    >['content']['application/json']
    const apiBody: AssignBody = {
      badgeCode: req.badgeCode,
      userIds: req.userIds,
      ...(req.reason !== undefined ? { reason: req.reason } : {}),
    }
    const res = await api.assignAdminBadge(apiBody)
    return extract(res, BadgesListResponseSchema, 'assignBadge')
  },

  async getAnalytics(params: AnalyticsQuery = {}) {
    const validated = AnalyticsQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminAnalytics(
      validated as paths['/api/admin/analytics']['get']['parameters']['query'],
    )
    return extract(res, AnalyticsResponseSchema, 'getAnalytics')
  },

  async getKajabi() {
    const api = getApiClient()
    const res = await api.getAdminKajabi()
    return extract(res, KajabiResponseSchema, 'getKajabi')
  },

  async testKajabi(body: unknown) {
    const api = getApiClient()
    const req = KajabiTestSchema.parse(body)
    const res = await api.testAdminKajabi(req)
    return extract(res, KajabiTestResponseSchema, 'testKajabi')
  },

  async reprocessKajabi(body: unknown) {
    const api = getApiClient()
    const req = KajabiReprocessSchema.parse(body)
    const res = await api.reprocessAdminKajabi(req)
    return extract(res, KajabiTestResponseSchema, 'reprocessKajabi')
  },
}

export type {
  AdminSubmission,
  AdminUser,
  AdminBadge,
  KajabiEvent,
  KajabiStats,
  Pagination,
  SubmissionsQuery,
  UsersQuery,
  AnalyticsQuery,
}
