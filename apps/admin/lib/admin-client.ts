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
} from '@elevate/types/admin-api-types'
import {
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  UpdateUserSchema,
  BulkUpdateUsersSchema,
  AssignBadgeSchema,
  KajabiReprocessSchema,
  KajabiTestSchema,
} from '@elevate/types/admin-schemas'
import {
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  UpdateUserSchema,
  BulkUpdateUsersSchema,
  AssignBadgeSchema,
  KajabiTestSchema,
  KajabiReprocessSchema,
} from '@elevate/types/admin-schemas'

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

function extract<T>(response: unknown, schema: z.ZodSchema<{ success: true; data: T }>, ctx: string): T {
  try {
    const parsed = schema.parse(response)
    return parsed.data
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdminClientError(`Invalid response in ${ctx}: ${error.message}`, error)
    }
    throw new AdminClientError(`Unexpected error in ${ctx}`, error)
  }
}

function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

export const adminClient = {
  async getCohorts(): Promise<string[]> {
    const api = getApiClient()
    const res = await api.getAdminCohorts()
    return extract(res, CohortsResponseSchema, 'getCohorts').cohorts
  },

  async getSubmissions(params: SubmissionsQuery = {}): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }> {
    const validated = SubmissionsQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminSubmissions(
      cleanParams(validated) as paths['/api/admin/submissions']['get']['parameters']['query']
    )
    return extract(res, SubmissionsListResponseSchema, 'getSubmissions')
  },

  async reviewSubmission(body: paths['/api/admin/submissions']['patch']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/submissions']['patch']['requestBody']['content']['application/json'] = ReviewSubmissionSchema.parse(body)
    const res = await api.reviewSubmission(req)
    return extract(res, ReviewResponseSchema, 'reviewSubmission')
  },

  async bulkReview(body: paths['/api/admin/submissions']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/submissions']['post']['requestBody']['content']['application/json'] = BulkReviewSubmissionsSchema.parse(body)
    const res = await api.bulkReview(req)
    return extract(res, BulkReviewResponseSchema, 'bulkReview')
  },

  async getUsers(params: UsersQuery = {}): Promise<{ users: AdminUser[]; pagination: Pagination }> {
    const validated = UsersQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminUsers(
      cleanParams(validated) as paths['/api/admin/users']['get']['parameters']['query']
    )
    return extract(res, UsersListResponseSchema, 'getUsers')
  },

  async updateUser(body: paths['/api/admin/users']['patch']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/users']['patch']['requestBody']['content']['application/json'] = UpdateUserSchema.parse(body)
    const res = await api.updateAdminUser(req)
    return extract(res, UpdateUserResponseSchema, 'updateUser')
  },

  async bulkUpdateUsers(body: paths['/api/admin/users']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/users']['post']['requestBody']['content']['application/json'] = BulkUpdateUsersSchema.parse(body)
    const res = await api.bulkUpdateAdminUsers(req)
    return extract(res, BulkUpdateUsersResponseSchema, 'bulkUpdateUsers')
  },

  async getBadges(_includeCounts?: boolean): Promise<{ badges: AdminBadge[] }> {
    const api = getApiClient()
    const res = await api.getAdminBadges()
    return extract(res, BadgesListResponseSchema, 'getBadges')
  },

  async createBadge(body: paths['/api/admin/badges']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const CreateBadgeSchema = z.object({ code: z.string(), name: z.string(), description: z.string() }).passthrough()
    const req: paths['/api/admin/badges']['post']['requestBody']['content']['application/json'] = CreateBadgeSchema.parse(body)
    const res = await api.createAdminBadge(req)
    return extract(res, BadgesListResponseSchema, 'createBadge')
  },

  async updateBadge(body: paths['/api/admin/badges']['patch']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const UpdateBadgeSchema = z.object({ code: z.string() }).passthrough()
    const req: paths['/api/admin/badges']['patch']['requestBody']['content']['application/json'] = UpdateBadgeSchema.parse(body)
    const res = await api.updateAdminBadge(req)
    return extract(res, BadgesListResponseSchema, 'updateBadge')
  },

  async deleteBadge(code: string) {
    const api = getApiClient()
    const res = await api.deleteAdminBadge(code)
    return extract(res, BadgesListResponseSchema, 'deleteBadge')
  },

  async assignBadge(body: paths['/api/admin/badges/assign']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/badges/assign']['post']['requestBody']['content']['application/json'] = AssignBadgeSchema.parse(body)
    const res = await api.assignAdminBadge(req)
    return extract(res, BadgesListResponseSchema, 'assignBadge')
  },

  async getAnalytics(params: AnalyticsQuery = {}) {
    const validated = AnalyticsQuerySchema.parse(params)
    const api = getApiClient()
    const res = await api.getAdminAnalytics(
      validated as paths['/api/admin/analytics']['get']['parameters']['query']
    )
    return extract(res, AnalyticsResponseSchema, 'getAnalytics')
  },

  async getKajabi() {
    const api = getApiClient()
    const res = await api.getAdminKajabi()
    return extract(res, KajabiResponseSchema, 'getKajabi')
  },

  async testKajabi(body: paths['/api/admin/kajabi/test']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/kajabi/test']['post']['requestBody']['content']['application/json'] = KajabiTestSchema.parse(body)
    const res = await api.testAdminKajabi(req)
    return extract(res, KajabiTestResponseSchema, 'testKajabi')
  },

  async reprocessKajabi(body: paths['/api/admin/kajabi/reprocess']['post']['requestBody']['content']['application/json']) {
    const api = getApiClient()
    const req: paths['/api/admin/kajabi/reprocess']['post']['requestBody']['content']['application/json'] = KajabiReprocessSchema.parse(body)
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
