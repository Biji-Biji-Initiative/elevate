import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { TRACE_HEADER } from '@elevate/http'

vi.mock('@elevate/db/client', () => {
  return {
    prisma: {
      // Force materialized views path to fail to hit fallback
      $queryRaw: vi.fn(async () => {
        throw new Error('views unavailable')
      }),
      user: {
        count: vi.fn(async () => 3),
      },
      submission: {
        count: vi.fn(async () => 10),
      },
      pointsLedger: {
        aggregate: vi.fn(async () => ({ _sum: { delta_points: 1000 } })),
      },
    },
  }
})

function makeRequest(url: string, traceId?: string): NextRequest {
  const u = new URL(url)
  const headers = new Headers()
  if (traceId) headers.set(TRACE_HEADER, traceId)
  return { url: u.toString(), nextUrl: u, headers } as unknown as NextRequest
}

describe('GET /api/stats - trace header', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('sets a trace header on responses', async () => {
    const req = makeRequest('http://localhost/api/stats', 't-web-stats')
    const { GET } = await import('../app/api/stats/route')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const headerVal = res.headers.get(TRACE_HEADER)
    expect(headerVal).toBeTruthy()
  })
})

