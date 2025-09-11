import { Prisma } from '@prisma/client'
import { prisma } from '@elevate/db/client'
import type { StageMetricsDTO } from '@elevate/types/dto-mappers'

type RawStageCounts = {
  stage: string
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  uniqueEducators: number
  points: Array<{ points_awarded: number | null }>
  topSchools: Array<{ name: string; count: number }>
  cohortBreakdown: Array<{ cohort: string; count: number }>
  monthly: Array<{ month: string; submissions: number; approvals: number }>
}

function buildStageMetricsDTO(raw: RawStageCounts): StageMetricsDTO {
  const totalApprovedPoints = raw.points.reduce(
    (sum, s) => sum + (s.points_awarded || 0),
    0,
  )
  const avgPointsEarned =
    raw.approvedSubmissions > 0
      ? totalApprovedPoints / raw.approvedSubmissions
      : 0

  const monthlyTrend = [...raw.monthly].sort((a, b) =>
    a.month.localeCompare(b.month),
  )

  const completionRate =
    raw.totalSubmissions > 0
      ? raw.approvedSubmissions / raw.totalSubmissions
      : 0

  return {
    stage: raw.stage,
    totalSubmissions: raw.totalSubmissions,
    approvedSubmissions: raw.approvedSubmissions,
    pendingSubmissions: raw.pendingSubmissions,
    rejectedSubmissions: raw.rejectedSubmissions,
    avgPointsEarned,
    uniqueEducators: raw.uniqueEducators,
    topSchools: raw.topSchools,
    cohortBreakdown: raw.cohortBreakdown,
    monthlyTrend,
    completionRate,
  }
}

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
  const raw: RawStageCounts = {
    stage: activityCode,
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    uniqueEducators: uniqueEducatorGroups.length,
    points: pointsNormalized,
    topSchools: topSchoolsRaw
      .filter((r) => r.school)
      .map((r) => ({ name: String(r.school), count: r._count.id })),
    cohortBreakdown: cohortRaw
      .filter((r) => r.cohort)
      .map((r) => ({ cohort: String(r.cohort), count: r._count.id })),
    monthly: monthlyRaw,
  }
  return buildStageMetricsDTO(raw)
}

