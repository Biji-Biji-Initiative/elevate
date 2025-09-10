import { z } from 'zod'

import type { paths } from '@elevate/openapi/sdk'
import {
  UpdateUserSchema,
  BulkUpdateUsersSchema,
  AssignBadgeSchema,
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  KajabiTestSchema,
  KajabiReprocessSchema,
} from '@elevate/types/admin-schemas'

// Local create/update badge schemas for UI → API mapping
const CreateBadgeSchema = z
  .object({ code: z.string(), name: z.string(), description: z.string() })
  .passthrough()

const UpdateBadgeSchema = z.object({ code: z.string() }).passthrough()

export type CreateBadgeBody = NonNullable<
  paths['/api/admin/badges']['post']['requestBody']
>['content']['application/json']
export type UpdateBadgeBody = NonNullable<
  paths['/api/admin/badges']['patch']['requestBody']
>['content']['application/json']
export type AssignBadgeBody = NonNullable<
  paths['/api/admin/badges/assign']['post']['requestBody']
>['content']['application/json']
export type UpdateUserBody = NonNullable<
  paths['/api/admin/users']['patch']['requestBody']
>['content']['application/json']
export type BulkUpdateUsersBody = NonNullable<
  paths['/api/admin/users']['post']['requestBody']
>['content']['application/json']
export type ReviewSubmissionBody = NonNullable<
  paths['/api/admin/submissions']['patch']['requestBody']
>['content']['application/json']
export type BulkReviewBody = NonNullable<
  paths['/api/admin/submissions']['post']['requestBody']
>['content']['application/json']
export type KajabiTestBody = NonNullable<
  paths['/api/admin/kajabi/test']['post']['requestBody']
>['content']['application/json']
export type KajabiReprocessBody = NonNullable<
  paths['/api/admin/kajabi/reprocess']['post']['requestBody']
>['content']['application/json']

export function buildCreateBadgeBody(input: unknown): CreateBadgeBody {
  return CreateBadgeSchema.parse(input) as CreateBadgeBody
}

export function buildUpdateBadgeBody(input: unknown): UpdateBadgeBody {
  return UpdateBadgeSchema.parse(input) as UpdateBadgeBody
}

export function buildAssignBadgeBody(input: unknown): AssignBadgeBody {
  const parsed = AssignBadgeSchema.parse(input)
  const body: AssignBadgeBody = {
    badgeCode: parsed.badgeCode,
    userIds: parsed.userIds,
    ...(parsed.reason !== undefined ? { reason: parsed.reason } : {}),
  }
  return body
}

export function buildUpdateUserBody(input: unknown): UpdateUserBody {
  return UpdateUserSchema.parse(input)
}

export function buildBulkUpdateUsersBody(input: unknown): BulkUpdateUsersBody {
  return BulkUpdateUsersSchema.parse(input)
}

export function buildReviewSubmissionBody(
  input: unknown,
): ReviewSubmissionBody {
  const parsed = ReviewSubmissionSchema.parse(input)
  const body: ReviewSubmissionBody = {
    submissionId: parsed.submissionId,
    action: parsed.action,
    ...(parsed.reviewNote !== undefined
      ? { reviewNote: parsed.reviewNote }
      : {}),
    ...(parsed.pointAdjustment !== undefined
      ? { pointAdjustment: parsed.pointAdjustment }
      : {}),
  }
  return body
}

export function buildBulkReviewBody(input: unknown): BulkReviewBody {
  const parsed = BulkReviewSubmissionsSchema.parse(input)
  const body: BulkReviewBody = {
    submissionIds: parsed.submissionIds,
    action: parsed.action,
    ...(parsed.reviewNote !== undefined
      ? { reviewNote: parsed.reviewNote }
      : {}),
  }
  return body
}

export function buildKajabiTestBody(input: unknown): KajabiTestBody {
  return KajabiTestSchema.parse(input)
}

export function buildKajabiReprocessBody(input: unknown): KajabiReprocessBody {
  return KajabiReprocessSchema.parse(input)
}
