import { describe, it, expect } from 'vitest'
import { buildStageMetricsDTO, type RawStageCounts } from '../lib/metrics-helpers'

describe('buildStageMetricsDTO', () => {
  it('builds a valid DTO with completionRate and averages', () => {
    const raw: RawStageCounts = {
      stage: 'LEARN',
      totalSubmissions: 10,
      approvedSubmissions: 6,
      pendingSubmissions: 3,
      rejectedSubmissions: 1,
      uniqueEducators: 5,
      points: [{ points_awarded: 20 }, { points_awarded: 10 }, { points_awarded: null }],
      topSchools: [
        { name: 'School A', count: 3 },
        { name: 'School B', count: 2 },
      ],
      cohortBreakdown: [
        { cohort: 'A', count: 4 },
        { cohort: 'B', count: 2 },
      ],
      monthly: [
        { month: '2025-01', submissions: 3, approvals: 2 },
        { month: '2025-02', submissions: 7, approvals: 4 },
      ],
    }

    const dto = buildStageMetricsDTO(raw)
    expect(dto.stage).toBe('LEARN')
    expect(dto.totalSubmissions).toBe(10)
    expect(dto.approvedSubmissions).toBe(6)
    expect(dto.pendingSubmissions).toBe(3)
    expect(dto.rejectedSubmissions).toBe(1)
    expect(dto.avgPointsEarned).toBeCloseTo((20 + 10) / 6)
    expect(dto.completionRate).toBeCloseTo(6 / 10)
    expect(dto.uniqueEducators).toBe(5)
    expect(dto.monthlyTrend[0].month <= dto.monthlyTrend[1].month).toBe(true)
  })

  it('handles zero totals safely', () => {
    const raw: RawStageCounts = {
      stage: 'LEARN',
      totalSubmissions: 0,
      approvedSubmissions: 0,
      pendingSubmissions: 0,
      rejectedSubmissions: 0,
      uniqueEducators: 0,
      points: [],
      topSchools: [],
      cohortBreakdown: [],
      monthly: [],
    }
    const dto = buildStageMetricsDTO(raw)
    expect(dto.avgPointsEarned).toBe(0)
    expect(dto.completionRate).toBe(0)
  })
})
