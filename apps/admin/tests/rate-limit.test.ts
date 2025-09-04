import { describe, it, expect, vi } from 'vitest'

// Force rate limiter to block
vi.mock('@elevate/security', async () => ({
  adminRateLimiter: {},
  withRateLimit: async (_req: any, _limiter: any, _handler: any) => {
    return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded', retryAfter: 10 }), {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '40',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': `${Math.ceil(Date.now()/1000) + 10}`,
        'Retry-After': '10',
      }
    })
  },
}))

// Auth mock
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
  createErrorResponse: (err: unknown, status = 500) => new Response(JSON.stringify({ success: false, error: (err as Error)?.message || 'err' }), { status }),
}))

describe('Admin rate limit envelope', () => {
  it('returns a 429 with standard envelope and headers', async () => {
    const { GET } = await import('../app/api/admin/meta/cohorts/route')
    const req = { url: 'http://localhost/api/admin/meta/cohorts' } as any
    const res = await GET(req)
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('Rate')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Limit')).toBe('40')
  })
})

