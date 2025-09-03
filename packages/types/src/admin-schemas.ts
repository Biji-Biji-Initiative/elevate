import { z } from 'zod'

export const RoleEnum = z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'])

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
  role: RoleEnum.optional(),
  school: z.string().max(200).optional(),
  cohort: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/i).optional(),
})

export const BulkUpdateUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  role: RoleEnum,
})

export const AssignBadgeSchema = z.object({
  badgeCode: z.string().min(2).max(50),
  userIds: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().max(1000).optional(),
})

export const RemoveBadgeSchema = AssignBadgeSchema

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  cohort: z.string().max(200).optional(),
})

export const ExportsQuerySchema = z.object({
  type: z.enum(['submissions', 'users', 'leaderboard', 'points']),
  format: z.literal('csv'),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  activity: z.enum(['ALL', 'LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']).optional(),
  status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  cohort: z.string().max(200).optional(),
})

export const KajabiReprocessSchema = z.object({
  event_id: z.string().min(5),
})

export const KajabiTestSchema = z.object({
  user_email: z.string().email(),
  course_name: z.string().min(1).max(200),
})

// Email notification schemas
export const ApprovalEmailSchema = z.object({
  email: z.string().email(),
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
  email: z.string().email(),
  name: z.string().min(1).max(200),
  activityName: z.string().min(1).max(100),
  reviewerNote: z.string().min(1),
  dashboardUrl: z.string().url(),
  supportUrl: z.string().url(),
})

export const SubmissionConfirmationEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  activityName: z.string().min(1).max(100),
  submissionDate: z.string().min(1),
  dashboardUrl: z.string().url(),
})

export const WelcomeEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  dashboardUrl: z.string().url(),
})

