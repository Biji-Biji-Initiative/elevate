import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { StageMetricsDTOSchema } from '@elevate/types/dto-mappers'

// Mock Prisma client used by the route
const queryRawMock = vi.fn()
vi.mock('@elevate/db/client', () => {
  const submission = {
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where?.status === 'APPROVED') return 7
      if (where?.status === 'PENDING') return 2
      if (where?.status === 'REJECTED') return 1
      return 10
    }),
    groupBy: vi.fn(async () => [{ user_id: 'u1', _count: { id: 1 } }, { user_id: 'u2', _count: { id: 1 } }]),
    findMany: vi.fn(async () => [{ points_awarded: 15 }, { points_awarded: 25 }]),
  }
  const user = {
    groupBy: vi.fn(async () => [
      { school: 'School Z', _count: { id: 1 } },
      { cohort: '2025', _count: { id: 2 } },
    ]),
  }
  return { prisma: { submission, user, $queryRaw: queryRawMock } }
})

// Mock safe logger to avoid requiring built dist
vi.mock('@elevate/logging/safe-server', () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Mock rate limiter to avoid header/IP dependence
vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  publicApiRateLimiter: {},
}))

function makeRequest(url: string): NextRequest & {
  nextUrl: URL
  headers: Headers
  method: string
} {
  const u = new URL(url)
  const headers = new Headers()
  return {
    nextUrl: u,
    headers,
    method: 'GET',
  } as NextRequest & { nextUrl: URL; headers: Headers; method: string }
}

describe('GET /api/metrics (stage=shine)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a valid StageMetricsDTO envelope with expected fields', async () => {
    queryRawMock.mockResolvedValueOnce([{ delta_points: 15 }, { delta_points: 25 }])
    queryRawMock.mockResolvedValueOnce([
      { month: '2025-01', submissions: 2, approvals: 1 },
      { month: '2025-02', submissions: 8, approvals: 6 },
    ])
    const req = makeRequest('http://localhost/api/metrics?stage=shine')
    const { GET } = await import('../app/api/metrics/route')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    const parsed = StageMetricsDTOSchema.safeParse(body.data)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.stage).toBe('SHINE')
      expect(parsed.data.totalSubmissions).toBe(10)
      expect(parsed.data.approvedSubmissions).toBe(7)
      // completionRate = 7/10
      expect(parsed.data.completionRate).toBeCloseTo(0.7)
      // avgPointsEarned = (15+25)/7 ≈ 5.714 — but our helper divides by approvedSubmissions
      expect(parsed.data.avgPointsEarned).toBeCloseTo((15 + 25) / 7)
    }
  })
})
