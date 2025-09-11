import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'
import type { NextRequest } from 'next/server'

// Mock Prisma client used by the route
vi.mock('@elevate/db/client', () => {
  const learnTagGrant = {
    groupBy: vi.fn(async () => [
      { user_id: 'u1' },
      { user_id: 'u2' },
      { user_id: 'u3' },
    ]),
    count: vi.fn(async () => 5), // 5 distinct (user, tag) pairs across EDU users
  }
  const submission = {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      // Return approved AMPLIFY submissions with payloads
      const activityCode =
        where && typeof where === 'object' && 'activity_code' in where
          ? (where as Record<string, unknown>).activity_code
          : undefined
      if (activityCode === 'AMPLIFY') {
        return [
          { payload: { peers_trained: 10, students_trained: 25 } },
          { payload: { peers_trained: 5, students_trained: 15 } },
        ]
      }
      return []
    }),
    count: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      // stories_shared: approved PRESENT submissions
      const activityCode =
        where && typeof where === 'object' && 'activity_code' in where
          ? (where as Record<string, unknown>).activity_code
          : undefined
      if (activityCode === 'PRESENT') return 7
      return 0
    }),
  }
  return { prisma: { learnTagGrant, submission } }
})

// Mock safe logger to avoid requiring built dist
vi.mock('@elevate/logging/safe-server', () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

function makeRequest(url: string): NextRequest {
  const u = new URL(url)
  const headers = new Headers()
  return { url: u.toString(), nextUrl: u, headers } as unknown as NextRequest
}

describe('GET /api/stats (Option B parity)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('computes counters from tag grants and approved submissions', async () => {
    const req = makeRequest('http://localhost/api/stats')
    const { GET } = await import('../app/api/stats/route')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await readJson<{ success?: boolean; data?: any }>(res)
    expect(body?.success).toBe(true)
    expect(body?.data?.counters).toBeTruthy()
    const c = body.data.counters
    // learners = distinct EDU users with LEARN grants: mocked groupBy returns 3
    expect(c.educators_learning).toBe(3)
    // peers+students from approved AMPLIFY payloads: (10+25) + (5+15) = 55
    expect(c.peers_students_reached).toBe(55)
    // stories_shared: approved PRESENT submissions = 7
    expect(c.stories_shared).toBe(7)
    // micro_credentials: distinct (user, tag) grants count = 5 (mocked)
    expect(c.micro_credentials).toBe(5)
    // mce_certified is placeholder 0
    expect(c.mce_certified).toBe(0)
  })
})
