import crypto from 'crypto'

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate limiter to pass-through
vi.mock('@elevate/security/rate-limiter', async () => ({
  webhookRateLimiter: {},
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
}))

// Mock next/headers to provide signature
let currentSignature = ''
vi.mock('next/headers', async () => ({
  headers: async () => new Map([['x-kajabi-signature', currentSignature]]),
}))

// Prisma mocks
const userFindUniqueMock = vi.fn()
const kajabiEventFindUniqueMock = vi.fn()
const pointsLedgerFindFirstMock = vi.fn()
const kajabiEventCreateMock = vi.fn()
const pointsLedgerCreateMock = vi.fn()
const submissionCreateMock = vi.fn()

vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock, update: vi.fn() },
    kajabiEvent: { findUnique: kajabiEventFindUniqueMock, create: kajabiEventCreateMock, upsert: vi.fn() },
    pointsLedger: { findFirst: pointsLedgerFindFirstMock, create: pointsLedgerCreateMock },
    activity: { findUnique: vi.fn(async () => ({ code: 'LEARN', default_points: 20 })) },
    submission: { create: submissionCreateMock },
    auditLog: { create: vi.fn() },
  },
}))

describe('Kajabi webhook - idempotency behavior', () => {
  beforeEach(() => {
    userFindUniqueMock.mockReset()
    kajabiEventFindUniqueMock.mockReset()
    pointsLedgerFindFirstMock.mockReset()
    kajabiEventCreateMock.mockReset()
    pointsLedgerCreateMock.mockReset()
    submissionCreateMock.mockReset()
    process.env.KAJABI_WEBHOOK_SECRET = 'secret'
  })

  function sign(body: string) {
    return crypto.createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET!).update(body).digest('hex')
  }

  it('returns already_processed on duplicate event', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')

    const event = {
      event_type: 'contact.tagged',
      event_id: 'evt_1',
      contact: { id: 123, email: 'user@example.com' },
      tag: { name: 'LEARN_COMPLETED' }
    }
    const body = JSON.stringify(event)
    currentSignature = sign(body)

    userFindUniqueMock.mockResolvedValue({ id: 'user_1', email: 'user@example.com' })
    kajabiEventFindUniqueMock.mockResolvedValueOnce(null)
    pointsLedgerFindFirstMock.mockResolvedValueOnce(null)

    // First call: process normally
    const req1 = new Request('http://localhost/api/kajabi/webhook', { method: 'POST', body })
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)

    // Second call: simulate existing event
    kajabiEventFindUniqueMock.mockResolvedValueOnce({ id: 'evt_1' })
    const req2 = new Request('http://localhost/api/kajabi/webhook', { method: 'POST', body })
    const res2 = await POST(req2)
    const json2 = await res2.json()
    expect(json2.success).toBe(true)
    expect(json2.data.result.reason).toBe('already_processed')
  })
})
