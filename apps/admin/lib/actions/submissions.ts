'use server'

import { mergeOptional, nonEmptyString } from '@/lib/utils/param-builder'
import { listSubmissionsService, getSubmissionByIdService, reviewSubmissionService, bulkReviewService } from '@/lib/server/submissions-service'
import { getCohorts as getCohortsSSR } from '@/lib/services/submissions'
import { type AdminSubmission, type Pagination } from '@elevate/types/admin-api-types'

// Server actions for submissions
export async function reviewSubmissionAction(body: {
  submissionId: string
  action: 'approve' | 'reject'
  reviewNote?: string
  pointAdjustment?: number
}): Promise<{ message: string; pointsAwarded?: number }> {
  return reviewSubmissionService(body)
}

export async function bulkReviewAction(body: {
  submissionIds: string[]
  action: 'approve' | 'reject'
  reviewNote?: string
}): Promise<{ processed: number; failed: number; errors: Array<{ submissionId: string; error: string }> }>
{
  return bulkReviewService(body)
}

export async function getSubmissionByIdAction(id: string): Promise<{ submission: AdminSubmission; evidence?: string }>
{
  return getSubmissionByIdService(id)
}

export async function listSubmissionsAction(query: Record<string, string | number | undefined>)
  : Promise<{ submissions: AdminSubmission[]; pagination: Pagination }>
{
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? 50)
  const sortBy = (query.sortBy as 'created_at' | 'updated_at' | 'status') ?? 'created_at'
  const sortOrder = (query.sortOrder as 'asc' | 'desc') ?? 'desc'
  let params: Parameters<typeof listSubmissionsService>[0] = { page, limit, sortBy, sortOrder }
  if (nonEmptyString(query.status)) params = mergeOptional(params, 'status', query.status as string)
  if (nonEmptyString(query.activity)) params = mergeOptional(params, 'activity', query.activity as string)
  if (nonEmptyString(query.userId)) params = mergeOptional(params, 'userId', query.userId as string)
  return listSubmissionsService(params)
}

export async function getCohortsAction(): Promise<string[]> {
  return getCohortsSSR()
}
