import { parseActivityCode, type ActivityCode } from '@elevate/types'

type StageCounts = { total: number; approved: number; pending: number; rejected: number }

export function formatActivityBreakdown(
  breakdown: Record<string, StageCounts> | null | undefined
): Partial<Record<ActivityCode, StageCounts>> {
  const byStage: Partial<Record<ActivityCode, StageCounts>> = {}
  if (!breakdown) return byStage
  for (const [code, counts] of Object.entries(breakdown)) {
    const parsed = parseActivityCode(code)
    if (!parsed) continue
    byStage[parsed] = counts
  }
  return byStage
}

export function computeApprovalRate(approved: number, rejected: number): number {
  const denom = approved + rejected
  if (denom <= 0) return 0
  return Math.round(((approved / denom) * 100) * 100) / 100
}

export function computeActivationRate(active: number, total: number): number {
  if (total <= 0) return 0
  return Math.round(((active / total) * 100) * 100) / 100
}

// Web stats helpers
export function formatCohortPerformanceStats(
  rows: Array<{ cohort_name: string; user_count: number; avg_points_per_user: number }>
): Array<{ name: string; count: number; avgPoints: number }> {
  return rows.map((r) => ({
    name: r.cohort_name,
    count: Number(r.user_count),
    avgPoints: Math.round(Number(r.avg_points_per_user) * 100) / 100,
  }))
}

export function formatMonthlyGrowthStats(
  rows: Array<{ month_label: string; new_educators: number; new_submissions: number }>
): Array<{ month: string; educators: number; submissions: number }> {
  return rows
    .map((m) => ({
      month: m.month_label,
      educators: Number(m.new_educators),
      submissions: Number(m.new_submissions),
    }))
    .reverse()
}
