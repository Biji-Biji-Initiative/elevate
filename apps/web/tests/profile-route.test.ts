import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Mock Clerk auth to simulate public viewer (no userId)
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: null }),
}))

// Mock DB service layer
vi.mock('@elevate/db', () => ({
  getPublicProfileByHandle: vi.fn(async (_handle: string) => null),
  getTotalPointsByUserId: vi.fn(async () => 0),
  findUserByHandle: vi.fn(async () => null),
  findSubmissionsByUserId: vi.fn(async () => []),
  findEarnedBadgesByUserId: vi.fn(async () => []),
}))

function makeRequest(path: string): NextRequest {
  const url = new URL(`http://localhost${path}`)
  return { url: url.toString(), nextUrl: url, headers: new Headers() } as unknown as NextRequest
}

describe('GET /api/profile/[handle]', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 404 for missing or non-public profile', async () => {
    const req = makeRequest('/api/profile/test-user')
    const mod = await import('../app/api/profile/[handle]/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(404)
  })

  it('returns public profile DTO when available', async () => {
    const db = await import('@elevate/db')
    const req = makeRequest('/api/profile/tester')
    // @ts-expect-error dynamic mock
    db.findUserByHandle = vi.fn(async () => ({
      id: 'u1', handle: 'tester', name: 'Tester', school: null, cohort: null, created_at: new Date(),
    }))
    // @ts-expect-error dynamic mock
    db.getPublicProfileByHandle = vi.fn(async () => ({
      id: 'u1', handle: 'tester', name: 'Tester', school: null, cohort: null, created_at: new Date(), submissions: [{ id: 's1', activity_code: 'LEARN', activity: { name: 'Learn', code: 'LEARN' }, status: 'APPROVED', visibility: 'PUBLIC', payload: {}, created_at: new Date(), updated_at: new Date() }], earned_badges: []
    }))
    const mod = await import('../app/api/profile/[handle]/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    const body = JSON.parse(text) as { success: boolean; data?: { handle?: string } }
    expect(body?.success).toBe(true)
    expect(body?.data?.handle).toBe('tester')
  })
})
