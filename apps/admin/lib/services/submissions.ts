"use server"
import 'server-only'

import { mergeOptional } from '@/lib/utils/param-builder'
import { listSubmissionsService, getSubmissionByIdService } from '@/lib/server/submissions-service'
import type { SubmissionsQuery, AdminSubmission, Pagination } from '@elevate/types/admin-api-types'

type ListResult = { submissions: AdminSubmission[]; pagination: Pagination }

export async function listSubmissions(
  params: SubmissionsQuery = {},
): Promise<ListResult> {
  const page = Number(params.page ?? 1)
  const limit = Number(params.limit ?? 50)
  const sortBy = (params.sortBy as 'created_at' | 'updated_at' | 'status') ?? 'created_at'
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc'
  let args: Parameters<typeof listSubmissionsService>[0] = { page, limit, sortBy, sortOrder }
  if (params.status && params.status !== 'ALL') args = mergeOptional(args, 'status', params.status)
  if (params.activity && params.activity !== 'ALL') args = mergeOptional(args, 'activity', params.activity)
  if (params.userId) args = mergeOptional(args, 'userId', params.userId)
  return listSubmissionsService(args)
}

export async function getCohorts(): Promise<string[]> {
  const { prisma } = await import('@elevate/db')
  const rows = await prisma.user.findMany({ where: { cohort: { not: null } }, select: { cohort: true }, distinct: ['cohort'] })
  return rows.map((r) => r.cohort).filter((c): c is string => typeof c === 'string' && c.length > 0)
}

export async function getSubmissionById(id: string): Promise<{ submission: AdminSubmission; evidence?: string }>
{
  return getSubmissionByIdService(id)
}
