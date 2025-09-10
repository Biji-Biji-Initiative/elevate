import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@elevate/db/client', () => ({
  prisma: {
    submission: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    user: {
      groupBy: vi.fn(async () => []),
    },
    $queryRaw: vi.fn(async () => []),
  },
}))

function makeRequest(url: string): NextRequest {
  const u = new URL(url)
  return { url: u.toString(), nextUrl: u } as unknown as NextRequest
}

describe('GET /api/metrics', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('rejects invalid stage', async () => {
    const req = makeRequest('http://localhost/api/metrics?stage=invalid')
    const mod = await import('../app/api/metrics/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(400)
  })

  it('accepts valid stage and returns success', async () => {
    const req = makeRequest('http://localhost/api/metrics?stage=learn')
    const mod = await import('../app/api/metrics/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
  })
})

