import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

import { StatsResponseDTOSchema } from '@elevate/types/dto-mappers'

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

function makeRequest(url: string): NextRequest {
  const u = new URL(url)
  return { url: u.toString(), nextUrl: u, headers: new Headers() } as unknown as NextRequest
}

describe('GET /api/stats - DTO shape', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns StatsResponseDTO envelope', async () => {
    const req = makeRequest('http://localhost/api/stats')
    const mod = await import('../app/api/stats/route')
    const res = await mod.GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    // Validate DTO structure
    const parsed = StatsResponseDTOSchema.safeParse(body.data)
    expect(parsed.success).toBe(true)
  })
})
