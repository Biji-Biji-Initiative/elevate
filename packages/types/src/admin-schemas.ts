import { z } from 'zod'

import { 
  UserRoleSchema,
  HandleSchema,
  EmailSchema,
  DateTimeWithOffsetSchema,
  ActivityFilterSchema,
  StatusFilterSchema,
  // Legacy aliases for backward compatibility
} from './domain-constants'

// RoleEnum is now imported from domain constants

export const ReviewSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().max(1000).optional(),
  pointAdjustment: z.number().int().min(-1000).max(1000).optional(),
})

export const BulkReviewSubmissionsSchema = z.object({
  submissionIds: z.array(z.string().min(1)).min(1).max(50),
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().max(1000).optional(),
})

export const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  role: UserRoleSchema.optional(),
  school: z.string().max(200).optional(),
  cohort: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  handle: HandleSchema.optional(),
})

export const BulkUpdateUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  role: UserRoleSchema,
})

export const AssignBadgeSchema = z.object({
  badgeCode: z.string().min(2).max(50),
  userIds: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().max(1000).optional(),
})

export const RemoveBadgeSchema = AssignBadgeSchema

export const AnalyticsQuerySchema = z.object({
  startDate: DateTimeWithOffsetSchema.optional(),
  endDate: DateTimeWithOffsetSchema.optional(),
  cohort: z.string().max(200).optional(),
})

export const ExportsQuerySchema = z.object({
  type: z.enum(['submissions', 'users', 'leaderboard', 'points']),
  format: z.literal('csv'),
  startDate: DateTimeWithOffsetSchema.optional(),
  endDate: DateTimeWithOffsetSchema.optional(),
  activity: ActivityFilterSchema.optional(),
  status: StatusFilterSchema.optional(),
  cohort: z.string().max(200).optional(),
})

export const KajabiReprocessSchema = z.object({
  event_id: z.string().min(5),
})

export const KajabiTestSchema = z.object({
  user_email: EmailSchema,
  course_name: z.string().min(1).max(200),
})

// Email notification schemas
export const ApprovalEmailSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(200),
  activityName: z.string().min(1).max(100),
  pointsAwarded: z.number().int().min(0),
  reviewerNote: z.string().optional(),
  totalPoints: z.number().int().min(0),
  leaderboardPosition: z.number().int().min(1),
  dashboardUrl: z.string().url(),
  leaderboardUrl: z.string().url(),
})

export const RejectionEmailSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(200),
  activityName: z.string().min(1).max(100),
  reviewerNote: z.string().min(1),
  dashboardUrl: z.string().url(),
  supportUrl: z.string().url(),
})

export const SubmissionConfirmationEmailSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(200),
  activityName: z.string().min(1).max(100),
  submissionDate: z.string().min(1),
  dashboardUrl: z.string().url(),
})

export const WelcomeEmailSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(200),
  dashboardUrl: z.string().url(),
})
