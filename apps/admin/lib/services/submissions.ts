"use server"
import 'server-only'

import type { ListSubmissionsParams } from '@/lib/server/submissions-service'
import { listSubmissionsService, getSubmissionByIdService } from '@/lib/server/submissions-service'
import type { AdminSubmission, Pagination } from '@elevate/types/admin-api-types'

export async function listSubmissions(params: ListSubmissionsParams): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }> {
  const svc = listSubmissionsService as unknown as (p: ListSubmissionsParams) => Promise<{ submissions: AdminSubmission[]; pagination: Pagination }>
  const out = await svc(params)
  return out
}

export async function getSubmissionById(id: string): Promise<{ submission: AdminSubmission }> {
  const svc = getSubmissionByIdService as unknown as (id: string) => Promise<{ submission: AdminSubmission }>
  const out = await svc(id)
  return out
}

export async function getCohorts(): Promise<string[]> {
  const { prisma } = await import('@elevate/db')
  const rows = await prisma.user.findMany({ where: { cohort: { not: null } }, select: { cohort: true }, distinct: ['cohort'] })
  return rows.map((r) => r.cohort).filter((c): c is string => typeof c === 'string' && c.length > 0)
}
