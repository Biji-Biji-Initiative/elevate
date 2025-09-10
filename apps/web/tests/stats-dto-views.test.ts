import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Mock prisma to simulate materialized views path
vi.mock('@elevate/db/client', () => {
  type SqlTemplateLike = { strings?: ReadonlyArray<string> }
  return {
    prisma: {
      $queryRaw: vi.fn(async (sql: SqlTemplateLike) => {
        const q = String(sql?.strings?.[0] || '')
        if (q.includes('platform_stats_overview')) {
          return [
            {
              total_educators: 10,
              total_submissions: 50,
              total_points_awarded: 200,
              total_badges_earned: 30,
              total_badges_available: 5,
              activity_breakdown: {
                learn: { total: 10, approved: 8, pending: 1, rejected: 1 },
                explore: { total: 10, approved: 7, pending: 2, rejected: 1 },
                amplify: { total: 10, approved: 6, pending: 3, rejected: 1 },
                present: { total: 10, approved: 5, pending: 4, rejected: 1 },
                shine: { total: 10, approved: 4, pending: 5, rejected: 1 },
              },
              last_updated: new Date(),
            },
          ]
        }
        if (q.includes('cohort_performance_stats')) {
          return [
            { cohort_name: 'Cohort-2024-A', user_count: 5, avg_points_per_user: 20 },
          ]
        }
        if (q.includes('monthly_growth_stats')) {
          return [
            { month_label: '2025-01', new_educators: 3, new_submissions: 10 },
          ]
        }
        if (q.includes('FROM submissions')) {
          return [{ total_students: 100 }]
        }
        return []
      }),
    },
  }
})

function makeRequest(url: string): NextRequest {
  const u = new URL(url)
  return { url: u.toString(), nextUrl: u, headers: new Headers() } as unknown as NextRequest
}

describe('GET /api/stats (views path)', () => {
  beforeEach(() => vi.resetModules())

  it('returns DTO with materialized view data', async () => {
    const req = makeRequest('http://localhost/api/stats')
    const mod = await import('../app/api/stats/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    expect(body?.data?.totalEducators).toBe(10)
    expect(body?.data?.studentsImpacted).toBe(100)
    expect(body?.data?.byStage?.learn?.total).toBe(10)
  })
})
