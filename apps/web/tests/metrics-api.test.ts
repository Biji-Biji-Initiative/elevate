import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { StageMetricsDTOSchema } from '@elevate/types/dto-mappers'

// Mock Prisma client used by the route
vi.mock('@elevate/db/client', () => {
  const submission = {
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where?.status === 'APPROVED') return 6
      if (where?.status === 'PENDING') return 3
      if (where?.status === 'REJECTED') return 1
      return 10
    }),
    groupBy: vi.fn(async () => [{ user_id: 'u1', _count: { id: 2 } }, { user_id: 'u2', _count: { id: 1 } }]),
    findMany: vi.fn(async () => [{ points_awarded: 20 }, { points_awarded: 10 }]),
  }
  const user = {
    groupBy: vi.fn(async () => [
      { school: 'School A', _count: { id: 3 } },
      { school: 'School B', _count: { id: 2 } },
    ]),
  }
  return { prisma: { submission, user } }
})

// Route import will be done dynamically inside the test after mocks are set up

// Mock safe logger to avoid requiring built dist
vi.mock('@elevate/logging/safe-server', () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

function makeRequest(url: string): NextRequest & {
  nextUrl: URL
  headers: Headers
  method: string
} {
  // Create a minimal stub that satisfies the usage in the route
  const u = new URL(url)
  const headers = new Headers()
  return {
    nextUrl: u,
    headers,
    method: 'GET',
  } as NextRequest & { nextUrl: URL; headers: Headers; method: string }
}

describe('GET /api/metrics (stage)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a valid StageMetricsDTO envelope', async () => {
    const req = makeRequest('http://localhost/api/metrics?stage=learn')
    const { GET } = await import('../app/api/metrics/route')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    const parsed = StageMetricsDTOSchema.safeParse(body.data)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      // Spot-check a few fields
      expect(parsed.data.stage).toBe('LEARN')
      expect(parsed.data.totalSubmissions).toBe(10)
      expect(parsed.data.approvedSubmissions).toBe(6)
      expect(parsed.data.completionRate).toBeCloseTo(0.6)
    }
  })
})
