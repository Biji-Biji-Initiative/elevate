import { z } from 'zod'

import {
  SubmissionsListResponseSchema,
  SubmissionDetailResponseSchema,
  UsersListResponseSchema,
  BadgesListResponseSchema,
  AnalyticsResponseSchema,
  KajabiResponseSchema,
  CohortsResponseSchema,
  ReviewResponseSchema,
  BulkReviewResponseSchema,
  UpdateUserResponseSchema,
  BulkUpdateUsersResponseSchema,
  BadgeOperationResponseSchema,
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
  type OverviewStats,
  type Distributions,
  type Trends,
  type RecentActivity,
  type Performance,
  type SubmissionsQuery,
  type UsersQuery,
  type AnalyticsQuery,
} from '@elevate/types/admin-api-types'

import { AdminApiClient } from './api-client'
import { cleanQueryParams } from './utils'

// Helper to get API client. Avoids server-only imports so this file remains
// safe to use from Client Components. Authentication is handled by cookies
// via Clerk middleware; a Bearer token is optional and intentionally omitted
// in client environments to prevent bundling server-only modules.
function getApiClient() {
  const isServer = typeof window === 'undefined'
  const token = isServer ? undefined : undefined
  // Use NEXT_PUBLIC_SITE_URL which points to the web app where APIs are hosted
  // Don't pass empty baseUrl as that would make requests to admin's own origin
  return new AdminApiClient({
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    token,
  })
}

// Error handling for API responses
export class AdminClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AdminClientError'
  }
}

// Safe type guards for API responses
function isApiError(
  response: unknown,
): response is { success: false; error: string } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false
  )
}

function validateAndExtract<T>(
  response: unknown,
  schema: z.ZodType<{ success: true; data: T }, z.ZodTypeDef, unknown>,
  context: string,
): T {
  try {
    if (isApiError(response)) {
      throw new AdminClientError(`API Error: ${response.error}`, response)
    }

    const parsed = schema.parse(response)
    return parsed.data
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdminClientError(
        `Invalid response format in ${context}: ${error.message}`,
        error,
      )
    }
    if (error instanceof AdminClientError) {
      throw error
    }
    throw new AdminClientError(`Unexpected error in ${context}`, error)
  }
}

export const adminActions = {
  async getCohorts(): Promise<string[]> {
    try {
      const api = getApiClient()
      const response = await api.getAdminCohorts()
      return validateAndExtract(response, CohortsResponseSchema, 'getCohorts')
        .cohorts
    } catch (error) {
      throw new AdminClientError('Failed to fetch cohorts', error)
    }
  },

  async getSubmissions(
    params: SubmissionsQuery = {},
  ): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }> {
    try {
      const validatedParams = SubmissionsQuerySchema.parse(params)
      const cleanedParams = cleanQueryParams(validatedParams)

      const api = getApiClient()
      const response = await api.getAdminSubmissions(cleanedParams)
      return validateAndExtract(
        response,
        SubmissionsListResponseSchema,
        'getSubmissions',
      )
    } catch (error) {
      throw new AdminClientError('Failed to fetch submissions', error)
    }
  },

  async reviewSubmission(body: {
    submissionId: string
    action: 'approve' | 'reject'
    reviewNote?: string
    pointAdjustment?: number
  }): Promise<{ message: string; pointsAwarded?: number }> {
    try {
      const api = getApiClient()
      const response = await api.reviewSubmission(body)
      return validateAndExtract(
        response,
        ReviewResponseSchema,
        'reviewSubmission',
      )
    } catch (error) {
      throw new AdminClientError('Failed to review submission', error)
    }
  },

  async bulkReview(body: {
    submissionIds: string[]
    action: 'approve' | 'reject'
    reviewNote?: string
  }): Promise<{
    processed: number
    failed: number
    errors: Array<{ submissionId: string; error: string }>
  }> {
    try {
      const api = getApiClient()
      const response = await api.bulkReview(body)
      return validateAndExtract(
        response,
        BulkReviewResponseSchema,
        'bulkReview',
      )
    } catch (error) {
      throw new AdminClientError('Failed to bulk review submissions', error)
    }
  },

  async getSubmissionById(
    id: string,
  ): Promise<{ submission: AdminSubmission; evidence?: string }> {
    try {
      const api = getApiClient()
      const response = await api.getAdminSubmissionById(id)
      return validateAndExtract(
        response,
        SubmissionDetailResponseSchema,
        'getSubmissionById',
      )
    } catch (error) {
      throw new AdminClientError(`Failed to fetch submission ${id}`, error)
    }
  },

  async getUsers(
    params: UsersQuery = {},
  ): Promise<{ users: AdminUser[]; pagination: Pagination }> {
    try {
      const validatedParams = UsersQuerySchema.parse(params)
      const cleanedParams = cleanQueryParams(validatedParams)

      const api = getApiClient()
      const response = await api.getAdminUsers(cleanedParams)
      return validateAndExtract(response, UsersListResponseSchema, 'getUsers')
    } catch (error) {
      throw new AdminClientError('Failed to fetch users', error)
    }
  },

  async updateUser(body: {
    userId: string
    role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
    school?: string | null
    cohort?: string | null
    name?: string
    handle?: string
  }): Promise<{ message: string; user: AdminUser }> {
    try {
      const api = getApiClient()
      const response = await api.updateAdminUser(body)
      return validateAndExtract(
        response,
        UpdateUserResponseSchema,
        'updateUser',
      )
    } catch (error) {
      throw new AdminClientError('Failed to update user', error)
    }
  },

  async bulkUpdateUsers(body: {
    userIds: string[]
    role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  }): Promise<{
    processed: number
    failed: number
    errors: Array<{ userId: string; error: string }>
  }> {
    try {
      const api = getApiClient()
      const response = await api.bulkUpdateAdminUsers(body)
      return validateAndExtract(
        response,
        BulkUpdateUsersResponseSchema,
        'bulkUpdateUsers',
      )
    } catch (error) {
      throw new AdminClientError('Failed to bulk update users', error)
    }
  },

  async getBadges(includeStats = true): Promise<{ badges: AdminBadge[] }> {
    try {
      const api = getApiClient()
      const params = includeStats
        ? ({ includeStats: 'true' } as const)
        : undefined
      const response = await api.getAdminBadges(params)
      return validateAndExtract(response, BadgesListResponseSchema, 'getBadges')
    } catch (error) {
      throw new AdminClientError('Failed to fetch badges', error)
    }
  },

  // ----- New: Admin user profile fields (LEAPS) -----
  async getUserById(id: string): Promise<{
    user: {
      id: string
      email: string
      name?: string | null
      handle?: string | null
      user_type: 'EDUCATOR' | 'STUDENT'
      user_type_confirmed: boolean
      school?: string | null
      region?: string | null
      kajabi_contact_id?: string | null
      created_at: string
    }
  }> {
    try {
      const api = getApiClient()
      const response = await api.getAdminUserById(id)
      const schema = z.object({
        success: z.literal(true),
        data: z.object({
          user: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable().optional(),
            handle: z.string().nullable().optional(),
            user_type: z.enum(['EDUCATOR', 'STUDENT']),
            user_type_confirmed: z.boolean(),
            school: z.string().nullable().optional(),
            region: z.string().nullable().optional(),
            kajabi_contact_id: z.string().nullable().optional(),
            created_at: z.string(),
          }),
        }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError(`Failed to fetch user ${id}`, error)
    }
  },

  async updateUserById(
    id: string,
    body: { userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean; school?: string; region?: string },
  ): Promise<{ user: {
    id: string
    email: string
    name?: string | null
    handle?: string | null
    user_type: 'EDUCATOR' | 'STUDENT'
    user_type_confirmed: boolean
    school?: string | null
    region?: string | null
    kajabi_contact_id?: string | null
    created_at: string
  } }> {
    try {
      const api = getApiClient()
      const response = await api.patchAdminUserById(id, body)
      const schema = z.object({
        success: z.literal(true),
        data: z.object({
          user: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable().optional(),
            handle: z.string().nullable().optional(),
            user_type: z.enum(['EDUCATOR', 'STUDENT']),
            user_type_confirmed: z.boolean(),
            school: z.string().nullable().optional(),
            region: z.string().nullable().optional(),
            kajabi_contact_id: z.string().nullable().optional(),
            created_at: z.string(),
          }),
        }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError(`Failed to update user ${id}`, error)
    }
  },

  async createBadge(body: {
    code: string
    name: string
    description: string
    criteria: unknown
    icon_url?: string
  }): Promise<{ message: string }> {
    try {
      const api = getApiClient()
      const response = await api.createAdminBadge(body)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'createBadge',
      )
    } catch (error) {
      throw new AdminClientError('Failed to create badge', error)
    }
  },

  async updateBadge(body: {
    code: string
    name?: string
    description?: string
    criteria?: unknown
    icon_url?: string
  }): Promise<{ message: string }> {
    try {
      const api = getApiClient()
      const response = await api.updateAdminBadge(body)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'updateBadge',
      )
    } catch (error) {
      throw new AdminClientError('Failed to update badge', error)
    }
  },

  async deleteBadge(code: string): Promise<{ message: string }> {
    try {
      const api = await getApiClient()
      const response = await api.deleteAdminBadge(code)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'deleteBadge',
      )
    } catch (error) {
      throw new AdminClientError('Failed to delete badge', error)
    }
  },

  async assignBadge(body: {
    badgeCode: string
    userIds: string[]
    reason?: string
  }): Promise<{ message: string; processed?: number; failed?: number }> {
    try {
      const api = await getApiClient()
      const response = await api.assignAdminBadge(body)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'assignBadge',
      )
    } catch (error) {
      throw new AdminClientError('Failed to assign badge', error)
    }
  },

  async removeBadge(body: {
    badgeCode: string
    userIds: string[]
    reason?: string
  }): Promise<{ message: string; processed?: number; failed?: number }> {
    try {
      const api = await getApiClient()
      const response = await api.removeAdminBadge(body)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'removeBadge',
      )
    } catch (error) {
      throw new AdminClientError('Failed to remove badge', error)
    }
  },

  async getAnalytics(params: AnalyticsQuery = {}): Promise<{
    overview: OverviewStats
    distributions: Distributions
    trends: Trends
    recentActivity: RecentActivity
    performance: Performance
  }> {
    try {
      const validatedParams = AnalyticsQuerySchema.parse(params)

      const api = await getApiClient()
      const response = await api.getAdminAnalytics(validatedParams)
      return validateAndExtract(
        response,
        AnalyticsResponseSchema,
        'getAnalytics',
      )
    } catch (error) {
      throw new AdminClientError('Failed to fetch analytics', error)
    }
  },

  async getKajabi(): Promise<{ events: KajabiEvent[]; stats: KajabiStats }> {
    try {
      const api = await getApiClient()
      const response = await api.getAdminKajabi()
      return validateAndExtract(response, KajabiResponseSchema, 'getKajabi')
    } catch (error) {
      throw new AdminClientError('Failed to fetch Kajabi data', error)
    }
  },

  async testKajabi(body: {
    user_email: string
    course_name?: string
  }): Promise<{
    success: boolean
    message?: string
    test_mode?: boolean
    data?: Record<string, unknown>
  }> {
    try {
      const api = await getApiClient()
      const response = await api.testAdminKajabi(body)
      // Note: Test response has different structure, parse directly
      return KajabiTestResponseSchema.parse(response)
    } catch (error) {
      throw new AdminClientError('Failed to test Kajabi webhook', error)
    }
  },

  async reprocessKajabi(body: {
    event_id: string
  }): Promise<{ message: string }> {
    try {
      const api = await getApiClient()
      const response = await api.reprocessAdminKajabi(body)
      return validateAndExtract(
        response,
        BadgeOperationResponseSchema,
        'reprocessKajabi',
      )
    } catch (error) {
      throw new AdminClientError('Failed to reprocess Kajabi event', error)
    }
  },

  async getKajabiHealth(): Promise<{
    healthy: boolean
    hasKey: boolean
    hasSecret: boolean
  }> {
    try {
      const api = await getApiClient()
      const response = await api.getAdminKajabiHealth()
      const schema = z.object({
        success: z.literal(true),
        data: z.object({
          healthy: z.boolean(),
          hasKey: z.boolean(),
          hasSecret: z.boolean(),
        }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError('Failed to check Kajabi health', error)
    }
  },

  async inviteKajabi(body: {
    userId?: string
    email?: string
    name?: string
    offerId?: string | number
  }): Promise<{ invited: boolean; contactId?: number; withOffer: boolean }> {
    try {
      const api = await getApiClient()
      const response = await api.postAdminKajabiInvite(body)
      const schema = z.object({
        success: z.literal(true),
        data: z.object({
          invited: z.boolean(),
          contactId: z.number().optional(),
          withOffer: z.boolean(),
        }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError('Failed to send Kajabi invite', error)
    }
  },

  async enforceStorageRetention(body: {
    userId: string
    days?: number
  }): Promise<{ userId: string; days: number; deleted: number }> {
    try {
      const api = await getApiClient()
      const response = await api.postAdminStorageRetention(body)
      const schema = z.object({
        success: z.literal(true),
        data: z.object({
          userId: z.string(),
          days: z.number(),
          deleted: z.number(),
        }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError('Failed to enforce storage retention', error)
    }
  },

  async bulkUpdateLeapsUsers(body: {
    userIds: string[]
    userType?: 'EDUCATOR' | 'STUDENT'
    userTypeConfirmed?: boolean
    school?: string
    region?: string
  }): Promise<{ processed: number; failed: number; errors: Array<{ userId: string; error: string }> }> {
    try {
      const api = getApiClient()
      const response = await api.postAdminUsersLeaps(body)
      const schema = z.object({
        success: z.literal(true),
        data: z.object({ processed: z.number().int(), failed: z.number().int(), errors: z.array(z.object({ userId: z.string(), error: z.string() })) }),
      })
      const parsed = schema.parse(response)
      return parsed.data
    } catch (error) {
      throw new AdminClientError('Failed to bulk update LEAPS users', error)
    }
  },
}

// Export types and utilities
export type {
  AdminSubmission,
  AdminUser,
  AdminBadge,
  KajabiEvent,
  KajabiStats,
  SubmissionsQuery,
  UsersQuery,
  AnalyticsQuery,
}
