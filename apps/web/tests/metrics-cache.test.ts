import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'
import type { NextRequest } from 'next/server'

// Mock Prisma client used by the route
const queryRawMock = vi.fn()
vi.mock('@elevate/db/client', () => {
  const submission = {
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where?.status === 'APPROVED') return 5
      if (where?.status === 'PENDING') return 4
      if (where?.status === 'REJECTED') return 1
      return 10
    }),
    groupBy: vi.fn(async () => [{ user_id: 'u1', _count: { id: 2 } }]),
    findMany: vi.fn(async () => [{ points_awarded: 8 }, { points_awarded: 12 }]),
  }
  const user = {
    groupBy: vi.fn(async () => [
      { school: 'School A', _count: { id: 3 } },
      { cohort: '2024', _count: { id: 5 } },
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

describe('GET /api/metrics cache headers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('sets Cache-Control and returns StageMetricsDTO for stage=explore', async () => {
    queryRawMock.mockResolvedValueOnce([{ delta_points: 8 }, { delta_points: 12 }])
    queryRawMock.mockResolvedValueOnce([
      { month: '2025-01', submissions: 3, approvals: 2 },
      { month: '2025-02', submissions: 7, approvals: 4 },
    ])
    const req = makeRequest('http://localhost/api/metrics?stage=explore')
    const { GET } = await import('../app/api/metrics/route')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const cc = res.headers.get('Cache-Control') || ''
    expect(cc).toMatch(/s-maxage=\d+/)
    const json = await readJson<{ success: boolean; data: { stage: string } }>(res)
    expect(json.success).toBe(true)
    expect(json.data.stage).toBe('EXPLORE')
  })
})
