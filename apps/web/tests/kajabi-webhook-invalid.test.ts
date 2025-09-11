import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/security/rate-limiter', async () => ({
  webhookRateLimiter: {},
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
}))

let currentSignature = ''
vi.mock('next/headers', async () => ({
  headers: async () => new Map([['x-kajabi-signature', currentSignature]]),
}))

// Prisma minimal mocks to avoid DB hits
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    kajabiEvent: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn() },
    pointsLedger: { findFirst: vi.fn() },
    activity: { findUnique: vi.fn() },
    submission: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

describe('Kajabi webhook invalid cases', () => {
  beforeEach(() => {
    process.env.KAJABI_WEBHOOK_SECRET = 'secret'
  })

  it('rejects invalid signature (prod requires signature)', async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const { POST } = await import('../app/api/kajabi/webhook/route')
      const body = JSON.stringify({
        event_type: 'contact.tagged' as const,
        event_id: 'evt_1',
        created_at: new Date().toISOString(),
        contact: { id: 1, email: 'user@example.com' },
        tag: { name: 'elevate-ai-1-completed' },
      })
      currentSignature = 'bad-signature'
      const req = new Request('http://localhost/api/kajabi/webhook', { method: 'POST', body })
      const res = await POST(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.success).toBe(false)
    } finally {
      process.env.NODE_ENV = prevEnv
    }
  })

  it('rejects malformed JSON', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const badBody = '{ not-json'
    currentSignature = 'anything' // header present; verification will fail anyway after JSON parse
    const req = new Request('http://localhost/api/kajabi/webhook', { method: 'POST', body: badBody })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
