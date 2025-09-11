import { describe, it, expect } from 'vitest'

import { getStageMetricsService, type MetricsServiceDeps } from '@elevate/app-services'

describe('@elevate/app-services getStageMetricsService (DI)', () => {
  it('returns null for invalid stage', async () => {
    const res = await getStageMetricsService('invalid')
    expect(res).toBeNull()
  })

  it('computes metrics for EXPLORE using stubbed prisma', async () => {
    let call = 0
    const prismaStub = {
      submission: {
        count: async ({ where }: any) => {
          if (where?.status === 'APPROVED') return 2
          if (where?.status === 'PENDING') return 1
          if (where?.status === 'REJECTED') return 1
          return 4
        },
        groupBy: async () => [{ user_id: 'u1', _count: { id: 2 } }, { user_id: 'u2', _count: { id: 1 } }],
      },
      user: {
        groupBy: async ({ by }: any) => {
          if (by?.includes('school')) return [{ school: 'SMA 1', _count: { id: 5 } }]
          if (by?.includes('cohort')) return [{ cohort: '2024', _count: { id: 3 } }]
          return []
        },
      },
      $queryRaw: async <T,>(..._args: unknown[]): Promise<T> => {
        const current = call++
        if (current === 0) {
          return [{ delta_points: 10 }, { delta_points: 20 }] as unknown as T
        }
        return [
          { month: '2024-01', submissions: 2, approvals: 1 },
          { month: '2024-02', submissions: 2, approvals: 1 },
        ] as unknown as T
      },
    }

    const deps: Partial<MetricsServiceDeps> = { prisma: prismaStub as any }
    const res = await getStageMetricsService('explore', deps)
    expect(res).not.toBeNull()
    expect(res?.stage).toBe('EXPLORE')
    expect(res?.totalSubmissions).toBe(4)
    expect(res?.approvedSubmissions).toBe(2)
    expect(res?.pendingSubmissions).toBe(1)
    expect(res?.rejectedSubmissions).toBe(1)
    expect(res?.uniqueEducators).toBe(2)
    expect(res?.avgPointsEarned).toBe(15)
    expect(res?.topSchools[0]).toEqual({ name: 'SMA 1', count: 5 })
    expect(res?.cohortBreakdown[0]).toEqual({ cohort: '2024', count: 3 })
    expect(res?.monthlyTrend[0]).toEqual({ month: '2024-01', submissions: 2, approvals: 1 })
  })
})
