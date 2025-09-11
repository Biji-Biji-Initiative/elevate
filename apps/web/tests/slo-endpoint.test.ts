import { describe, it, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

function makeRequest(url: string, headers?: Record<string, string>): NextRequest {
  const u = new URL(url)
  const req = new Request(u, { headers })
  return Object.assign(req, { nextUrl: u }) as unknown as NextRequest
}

describe('GET /api/slo', () => {
  beforeEach(() => {
    delete process.env.ENABLE_INTERNAL_ENDPOINTS
    delete process.env.INTERNAL_METRICS_TOKEN
  })

  it('returns 404 when internal endpoints disabled', async () => {
    const mod = await import('../app/api/slo/route')
    const res = await mod.GET(makeRequest('http://localhost/api/slo'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with summary when enabled and token matches', async () => {
    process.env.ENABLE_INTERNAL_ENDPOINTS = '1'
    process.env.INTERNAL_METRICS_TOKEN = 'secret'
    const mod = await import('../app/api/slo/route')
    const res = await mod.GET(
      makeRequest('http://localhost/api/slo', { authorization: 'Bearer secret' }),
    )
    expect(res.status).toBe(200)
    const { readJson } = await import('./test-utils')
    const body = await readJson(res)
    expect(body?.success).toBe(true)
  })
})
