import crypto from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Mock rate limiter to pass through
vi.mock('@elevate/security/rate-limiter', () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, fn: () => Promise<Response>) => fn(),
  webhookRateLimiter: {},
}))

// Mock safe logger
vi.mock('@elevate/logging/safe-server', () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Prepare minimal NextRequest-like objects
function makePostRequest(url: string, body: string, headersInit: Record<string, string> = {}): NextRequest & {
  headers: Headers
  method: string
  text: () => Promise<string>
} {
  const headers = new Headers(headersInit)
  return {
    headers,
    method: 'POST',
    text: async () => body,
  } as NextRequest & { headers: Headers; method: string; text: () => Promise<string> }
}

describe('POST /api/kajabi/webhook', () => {
  const secret = 'test_secret'

  beforeEach(() => {
    vi.resetModules()
    process.env.KAJABI_WEBHOOK_SECRET = secret
  })

  it('rejects invalid signature', async () => {
    const body = JSON.stringify({})
    const req = makePostRequest('http://localhost/api/kajabi/webhook', body, {
      'x-kajabi-signature': 'bad',
    })
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('deduplicates on unique constraint (P2002)', async () => {
    // Mock prisma transaction to throw P2002 on first create
    vi.mock('@elevate/db/client', () => {
      interface PrismaError extends Error { code?: string }
      const tx = {
        kajabiEvent: {
          create: vi.fn(async () => {
            const err: PrismaError = new Error('Unique constraint')
            err.code = 'P2002'
            throw err
          }),
          update: vi.fn(async () => {}),
        },
      }
      return {
        prisma: {
          $transaction: async (fn: (t: typeof tx) => Promise<Response>) => fn(tx),
        },
      }
    })

    const payload = {
      event_id: 'evt_1',
      created_at: new Date().toISOString(),
      data: {
        contact: { id: 'contact_1', email: 'test@example.com' },
        tag: { name: 'elevate-ai-1-completed' },
      },
    }
    const body = JSON.stringify(payload)
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    const req = makePostRequest('http://localhost/api/kajabi/webhook', body, {
      'x-kajabi-signature': sig,
    })
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.duplicate).toBe(true)
  })
})
