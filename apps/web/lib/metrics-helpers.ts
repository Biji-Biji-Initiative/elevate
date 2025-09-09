import type { StageMetricsDTO } from '@elevate/types/dto-mappers'

export interface RawStageCounts {
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

export function buildStageMetricsDTO(raw: RawStageCounts): StageMetricsDTO {
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
