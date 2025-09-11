import crypto from 'crypto'

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate limiter to pass-through
vi.mock('@elevate/security/rate-limiter', async () => ({
  webhookRateLimiter: {},
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
}))

// No-op badges awarding to avoid extra DB plumbing
vi.mock('@elevate/logic', async () => ({
  grantBadgesForUser: vi.fn(async () => {}),
}))

// Prisma $transaction mock with stateful behavior across calls
let createCallCount = 0
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    $transaction: async (fn: (t: {
      kajabiEvent: { create: (args?: unknown) => Promise<unknown>; update: (args?: unknown) => Promise<unknown> }
      user: { findUnique: (args: { where?: { kajabi_contact_id?: string; email?: string } }) => Promise<unknown>; update: (args?: unknown) => Promise<unknown> }
      learnTagGrant: { create: (args?: unknown) => Promise<unknown> }
      pointsLedger: { create: (args?: unknown) => Promise<unknown> }
    }) => Promise<unknown>) => {
      const tx = {
        kajabiEvent: {
          create: vi.fn(async () => {
            createCallCount += 1
            if (createCallCount === 1) return { id: 'k1' }
            throw Object.assign(new Error('Unique constraint'), { code: 'P2002' as const })
          }),
          update: vi.fn(async () => {}),
        },
        user: {
          findUnique: vi.fn(async (args: { where?: { kajabi_contact_id?: string; email?: string } }) => {
            if (args?.where?.kajabi_contact_id) return null
            if (args?.where?.email) {
              return {
                id: 'user_1',
                email: 'user@example.com',
                user_type: 'EDUCATOR',
                kajabi_contact_id: null,
              }
            }
            return null
          }),
          update: vi.fn(async () => {}),
        },
        learnTagGrant: { create: vi.fn(async () => ({})) },
        pointsLedger: { create: vi.fn(async () => ({})) },
      }
      return fn(tx)
    },
  },
}))

describe('Kajabi webhook - idempotency behavior', () => {
  beforeEach(() => {
    createCallCount = 0
    process.env.KAJABI_WEBHOOK_SECRET = 'secret'
  })

  function sign(body: string) {
    return crypto
      .createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')
  }

  it('awards on first call and returns duplicate on retry', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')

    const event = {
      event_type: 'contact.tagged' as const,
      event_id: 'evt_1',
      created_at: new Date().toISOString(),
      contact: { id: 123, email: 'user@example.com' },
      tag: { name: 'elevate-ai-1-completed' },
    }
    const body = JSON.stringify(event)
    const reqHeaders = { 'x-kajabi-signature': sign(body) }

    // First call: award
    const req1 = new Request('http://localhost/api/kajabi/webhook', {
      method: 'POST',
      headers: reqHeaders,
      body,
    })
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.success).toBe(true)
    expect(json1.data.awarded).toBe(true)

    // Second call: duplicate
    const req2 = new Request('http://localhost/api/kajabi/webhook', {
      method: 'POST',
      headers: reqHeaders,
      body,
    })
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.success).toBe(true)
    expect(json2.data.duplicate).toBe(true)
  })
})
