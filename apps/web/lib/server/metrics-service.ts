"use server"
import 'server-only'

import { Prisma } from '@prisma/client'

import { prisma } from '@elevate/db/client'
import type { StageMetricsDTO } from '@elevate/types/dto-mappers'

import { buildStageMetricsDTO } from '../../lib/metrics-helpers'

const validStages = ['learn', 'explore', 'amplify', 'present', 'shine'] as const
type ValidStage = (typeof validStages)[number]

function isValidStage(stage: string): stage is ValidStage {
  return validStages.includes(stage as ValidStage)
}

export async function getStageMetricsService(stage: string): Promise<StageMetricsDTO | null> {
  if (!isValidStage(stage)) return null
  const activityCode = stage.toUpperCase() as 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'

  const [
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    uniqueEducatorGroups,
    points,
    topSchoolsRaw,
    cohortRaw,
    monthlyRaw,
  ] = await Promise.all([
    prisma.submission.count({ where: { activity_code: activityCode } }),
    prisma.submission.count({ where: { activity_code: activityCode, status: 'APPROVED' } }),
    prisma.submission.count({ where: { activity_code: activityCode, status: 'PENDING' } }),
    prisma.submission.count({ where: { activity_code: activityCode, status: 'REJECTED' } }),
    prisma.submission.groupBy({ by: ['user_id'], where: { activity_code: activityCode }, _count: { id: true } }),
    prisma.$queryRaw<Array<{ delta_points: number }>>(Prisma.sql`
      SELECT pl.delta_points
      FROM points_ledger pl
      WHERE pl.activity_code = ${activityCode}
        AND (
          pl.source = 'FORM' OR pl.source = 'WEBHOOK' OR pl.source = 'MANUAL'
        )
    `),
    prisma.user.groupBy({ by: ['school'], where: { submissions: { some: { activity_code: activityCode } } }, _count: { id: true } }),
    prisma.user.groupBy({ by: ['cohort'], where: { submissions: { some: { activity_code: activityCode } } }, _count: { id: true } }),
    prisma.$queryRaw<Array<{ month: string; submissions: number; approvals: number }>>(
      Prisma.sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS month,
          COUNT(*)::int AS submissions,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approvals
        FROM submissions
        WHERE activity_code = ${activityCode}
        GROUP BY 1
        ORDER BY 1
      `,
    ),
  ])

  const pointsNormalized = points.map((p) => ({ points_awarded: p.delta_points ?? 0 }))
  const raw = {
    stage: activityCode,
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    uniqueEducators: uniqueEducatorGroups.length,
    points: pointsNormalized,
    topSchools: topSchoolsRaw.filter((r) => r.school).map((r) => ({ name: String(r.school), count: r._count.id })),
    cohortBreakdown: cohortRaw.filter((r) => r.cohort).map((r) => ({ cohort: String(r.cohort), count: r._count.id })),
    monthly: monthlyRaw,
  }
  return buildStageMetricsDTO(raw)
}
