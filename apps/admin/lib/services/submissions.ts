"use server"
import 'server-only'

export { listSubmissionsService as listSubmissions, getSubmissionByIdService as getSubmissionById } from '@/lib/server/submissions-service'

export async function getCohorts(): Promise<string[]> {
  const { prisma } = await import('@elevate/db')
  const rows = await prisma.user.findMany({ where: { cohort: { not: null } }, select: { cohort: true }, distinct: ['cohort'] })
  return rows.map((r) => r.cohort).filter((c): c is string => typeof c === 'string' && c.length > 0)
}
