import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRACE_HEADER } from '@elevate/http'
import { readJson } from './test-utils'

const queryRawMock = vi.fn()

vi.mock('@elevate/db/client', async () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

describe('stats-optimized contract', () => {
  beforeEach(() => {
    queryRawMock.mockReset()
  })

  it('returns success envelope with headers', async () => {
    const { GET } = await import('../app/api/stats-optimized/route')

    // platform_stats_overview
    queryRawMock.mockResolvedValueOnce([{
      total_educators: 10,
      total_participants: 10,
      active_educators: 5,
      total_submissions: 20,
      approved_submissions: 10,
      pending_submissions: 5,
      rejected_submissions: 5,
      total_points_awarded: 100,
      avg_points_per_award: 10,
      total_badges_available: 3,
      total_badges_earned: 2,
      users_with_badges: 2,
      activity_breakdown: { LEARN: { total: 5, approved: 3, pending: 1, rejected: 1 } },
      last_updated: new Date(),
    }])
    // cohort_performance_stats
    queryRawMock.mockResolvedValueOnce([{ cohort_name: 'C1', user_count: 5, avg_points_per_user: 10 }])
    // monthly_growth_stats
    queryRawMock.mockResolvedValueOnce([{ month_label: 'Jan 2025', new_educators: 2, new_submissions: 3 }])
    // amplify students
    queryRawMock.mockResolvedValueOnce([{ total_students: 12 }])

    const req = new Request('http://localhost/api/stats-optimized')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get(TRACE_HEADER)).toBeTruthy()
    expect(res.headers.get('X-Stats-Source')).toBe('materialized-views')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
    expect(res.headers.get('X-Stats-Last-Updated')).toBeTruthy()
    const json = await readJson<{ success: boolean; data: { totalEducators: number } }>(res)
    expect(json.success).toBe(true)
    expect(json.data.totalEducators).toBe(10)
  })
})
