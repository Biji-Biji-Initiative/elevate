"use server"
import 'server-only'

import type { ListSubmissionsParams } from '@/lib/server/submissions-service'

export async function listSubmissions(params: ListSubmissionsParams) {
  const { listSubmissionsService } = await import('@/lib/server/submissions-service')
  return listSubmissionsService(params)
}

export async function getSubmissionById(id: string) {
  const { getSubmissionByIdService } = await import('@/lib/server/submissions-service')
  return getSubmissionByIdService(id)
}

export async function getCohorts(): Promise<string[]> {
  const { prisma } = await import('@elevate/db')
  const rows = await prisma.user.findMany({ where: { cohort: { not: null } }, select: { cohort: true }, distinct: ['cohort'] })
  return rows.map((r) => r.cohort).filter((c): c is string => typeof c === 'string' && c.length > 0)
}
