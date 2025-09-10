import { z } from 'zod'

import { BadgeCriteriaSchema } from './common'
import { 
  ActivityCodeSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  UserRoleSchema,
  ActivityFilterSchema,
  StatusFilterSchema,
  RoleFilterSchema,
  // Legacy aliases for backward compatibility
  ActivityCodeEnum,
  SubmissionStatusEnum,
  VisibilityEnum,
  RoleEnum,
} from './domain-constants'
import { SubmissionPayloadSchema } from './submission-payloads'
import { KajabiTagEventSchema } from './webhooks'

// All enums are now imported from domain constants
// Re-export for backward compatibility
export { ActivityCodeEnum, SubmissionStatusEnum, VisibilityEnum, RoleEnum }

// Base schemas
// Note: Canonical request PaginationSchema comes from domain-constants (page, limit, offset)
// For responses, define a dedicated schema including total and pages for UI needs

export const PaginationResponseSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  pages: z.number().int().min(0),
})

export const ActivitySchema = z.object({
  code: ActivityCodeSchema,
  name: z.string(),
  default_points: z.number().int().optional(),
})

export const UserMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  email: z.string().email().optional(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
})

// Submission schemas
// Relational attachment rows (canonical)
export const SubmissionAttachmentRelSchema = z.object({
  id: z.string(),
  submission_id: z.string(),
  path: z.string(),
})

export const AdminSubmissionSchema = z.object({
  id: z.string(),
  created_at: z.string(), // ISO date string
  updated_at: z.string().optional(),
  status: SubmissionStatusSchema,
  visibility: VisibilitySchema,
  review_note: z.string().nullable().optional(),
  points_awarded: z.number().int().optional(),
  payload: SubmissionPayloadSchema.transform(p => p.data),
  attachmentCount: z.number().int().optional().default(0),
  attachments_rel: z.array(SubmissionAttachmentRelSchema).optional().default([]),
  user: UserMiniSchema,
  activity: ActivitySchema,
  reviewer: UserMiniSchema.nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
})

export const SubmissionsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    submissions: z.array(AdminSubmissionSchema),
    pagination: PaginationResponseSchema,
  }),
})

export const SubmissionDetailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    submission: AdminSubmissionSchema,
    evidence: z.string().optional(), // Signed URL for evidence viewing
  }),
})

// User schemas
export const AdminUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatar_url: z.string().nullable().optional(),
  role: UserRoleSchema,
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  created_at: z.string(),
  _count: z.object({
    submissions: z.number().int(),
    ledger: z.number().int(),
    earned_badges: z.number().int(),
  }),
  totalPoints: z.number().int(),
})

export const UsersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    users: z.array(AdminUserSchema),
    pagination: PaginationResponseSchema,
  }),
})

// Badge schemas
// Re-use the canonical BadgeCriteriaSchema from common.ts to avoid duplicate symbol conflicts
// Use imported BadgeCriteriaSchema

export const BadgeEarnedSchema = z.object({
  id: z.string(),
  user: z.object({ id: z.string(), name: z.string(), handle: z.string() }),
  earned_at: z.string(),
})

export const AdminBadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  criteria: BadgeCriteriaSchema,
  icon_url: z.string().url().optional(),
  _count: z.object({ earned_badges: z.number().int() }).optional(),
  earned_badges: z.array(BadgeEarnedSchema).optional(),
})

export const BadgesListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    badges: z.array(AdminBadgeSchema),
  }),
})

// Analytics schemas
export const OverviewStatsSchema = z.object({
  submissions: z.object({
    total: z.number().int(),
    pending: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
    approvalRate: z.number(),
  }),
  users: z.object({
    total: z.number().int(),
    active: z.number().int(),
    withSubmissions: z.number().int(),
    withBadges: z.number().int(),
    activationRate: z.number(),
  }),
  points: z.object({
    totalAwarded: z.number().int(),
    totalEntries: z.number().int(),
    avgPerEntry: z.number(),
  }),
  badges: z.object({
    totalBadges: z.number().int(),
    totalEarned: z.number().int(),
    uniqueEarners: z.number().int(),
  }),
  reviews: z.object({
    pendingReviews: z.number().int(),
    avgReviewTimeHours: z.number(),
  }),
})

export const DistributionsSchema = z.object({
  submissionsByStatus: z.array(
    z.object({ status: z.string(), count: z.number().int() }),
  ),
  submissionsByActivity: z.array(
    z.object({
      activity: z.string(),
      activityName: z.string().optional(),
      count: z.number().int(),
    }),
  ),
  usersByRole: z.array(z.object({ role: z.string(), count: z.number().int() })),
  usersByCohort: z
    .array(
      z.object({
        cohort: z.string().nullable(),
        count: z.number().int(),
      }),
    )
    .optional(),
  pointsByActivity: z.array(
    z.object({
      activity: z.string(),
      activityName: z.string().optional(),
      totalPoints: z.number().int(),
      entries: z.number().int(),
    }),
  ),
  pointsDistribution: z
    .array(
      z.object({
        range: z.string(),
        count: z.number().int(),
      }),
    )
    .optional(),
})

export const TrendsSchema = z.object({
  submissionsByDate: z.array(
    z.object({
      date: z.string(),
      total: z.number().int(),
      approved: z.number().int(),
      rejected: z.number().int(),
      pending: z.number().int(),
    }),
  ),
  userRegistrationsByDate: z.array(
    z.object({
      date: z.string(),
      count: z.number().int(),
    }),
  ),
})

export const RecentActivitySchema = z.object({
  submissions: z.array(
    z.object({
      id: z.string(),
      activity_code: ActivityCodeSchema,
      user_name: z.string(),
      created_at: z.string(),
      status: SubmissionStatusSchema,
    }),
  ),
  approvals: z.array(
    z.object({
      id: z.string(),
      activity_code: ActivityCodeSchema,
      user_name: z.string(),
      reviewer_name: z.string(),
      approved_at: z.string(),
      points_awarded: z.number().int(),
    }),
  ),
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      created_at: z.string(),
      cohort: z.string().nullable(),
    }),
  ),
})

export const PerformanceSchema = z.object({
  reviewers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      reviewCount: z.number().int(),
      avgReviewTimeHours: z.number(),
      approvalRate: z.number(),
    }),
  ),
  topBadges: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      earnedCount: z.number().int(),
      uniqueEarners: z.number().int(),
    }),
  ),
})

export const AnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    overview: OverviewStatsSchema,
    distributions: DistributionsSchema,
    trends: TrendsSchema,
    recentActivity: RecentActivitySchema,
    performance: PerformanceSchema,
  }),
})

// Kajabi schemas
export const KajabiEventSchema = z.object({
  id: z.string(),
  received_at: z.string(),
  processed_at: z.string().nullable(),
  user_match: z.string().nullable(),
  payload: KajabiTagEventSchema,
})

export const KajabiStatsSchema = z.object({
  total_events: z.number().int(),
  processed_events: z.number().int(),
  matched_users: z.number().int(),
  unmatched_events: z.number().int(),
  points_awarded: z.number().int(),
})

export const KajabiResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    events: z.array(KajabiEventSchema),
    stats: KajabiStatsSchema,
  }),
})

// Cohorts schema
export const CohortsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    cohorts: z.array(z.string()),
  }),
})

// Operation response schemas
export const ReviewResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    pointsAwarded: z.number().int().optional(),
  }),
})

export const BulkReviewResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    processed: z.number().int(),
    failed: z.number().int(),
    errors: z.array(
      z.object({
        submissionId: z.string(),
        error: z.string(),
      }),
    ),
  }),
})

export const UpdateUserResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    user: AdminUserSchema,
  }),
})

export const BulkUpdateUsersResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    processed: z.number().int(),
    failed: z.number().int(),
    errors: z.array(
      z.object({
        userId: z.string(),
        error: z.string(),
      }),
    ),
  }),
})

export const BadgeOperationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    processed: z.number().int().optional(),
    failed: z.number().int().optional(),
  }),
})

export const KajabiTestResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  test_mode: z.boolean().optional(),
  data: z.object({
    event_id: z.string().optional(),
    contact_id: z.number().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    tag_name: z.string().optional(),
    processing_time: z.number().optional()
  }).optional(),
})

// Type exports
export type AdminSubmission = z.infer<typeof AdminSubmissionSchema>
export type AdminUser = z.infer<typeof AdminUserSchema>
export type AdminBadge = z.infer<typeof AdminBadgeSchema>
export type KajabiEvent = z.infer<typeof KajabiEventSchema>
export type KajabiStats = z.infer<typeof KajabiStatsSchema>
export type Pagination = z.infer<typeof PaginationResponseSchema>
export type OverviewStats = z.infer<typeof OverviewStatsSchema>
export type Distributions = z.infer<typeof DistributionsSchema>
export type Trends = z.infer<typeof TrendsSchema>
export type RecentActivity = z.infer<typeof RecentActivitySchema>
export type Performance = z.infer<typeof PerformanceSchema>

// Query parameter schemas
export const SubmissionsQuerySchema = z.object({
  status: StatusFilterSchema.optional(),
  activity: ActivityFilterSchema.optional(),
  userId: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  cohort: z.string().optional(),
})

export const UsersQuerySchema = z.object({
  search: z.string().optional(),
  role: RoleFilterSchema.optional(),
  cohort: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  sortBy: z.enum(['created_at', 'name', 'email']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cohort: z.string().optional(),
})

export type SubmissionsQuery = z.infer<typeof SubmissionsQuerySchema>
export type UsersQuery = z.infer<typeof UsersQuerySchema>
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>
