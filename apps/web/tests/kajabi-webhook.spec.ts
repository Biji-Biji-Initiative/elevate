import crypto from 'crypto'

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate limiter to always allow
vi.mock('@elevate/security/rate-limiter', () => ({
  webhookRateLimiter: {},
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => Promise<Response>) => handler(),
}))

// Prisma transaction and methods mocks
const kajabiEventCreate = vi.fn()
const kajabiEventUpdate = vi.fn()
const learnTagGrantCreate = vi.fn()
const pointsLedgerCreate = vi.fn()
const userFindUnique = vi.fn()
const userUpdate = vi.fn()

const tx = {
  kajabiEvent: { create: kajabiEventCreate, update: kajabiEventUpdate },
  learnTagGrant: { create: learnTagGrantCreate },
  pointsLedger: { create: pointsLedgerCreate },
  user: { findUnique: userFindUnique, update: userUpdate },
}

vi.mock('@elevate/db/client', () => ({
  prisma: {
    $transaction: (fn: any) => fn(tx),
  },
}))

// grantBadgesForUser stub
vi.mock(
  '@elevate/logic',
  () => ({
    grantBadgesForUser: vi.fn(),
  }),
  { virtual: true },
)

describe('Kajabi webhook', () => {
  beforeEach(() => {
    kajabiEventCreate.mockReset()
    kajabiEventUpdate.mockReset()
    learnTagGrantCreate.mockReset()
    pointsLedgerCreate.mockReset()
    userFindUnique.mockReset()
    userUpdate.mockReset()
    process.env.KAJABI_WEBHOOK_SECRET = 'secret'
  })

  function sign(body: string) {
    return crypto.createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET!).update(body).digest('hex')
  }

  const baseEvent = {
    event_id: 'evt1',
    created_at: new Date().toISOString(),
    contact: { id: 'c1', email: 'u@example.com' },
    tag: { name: 'Elevate-AI-1-Completed' },
  }

  it('processes once and dedupes replays', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const body = JSON.stringify(baseEvent)
    const req = () =>
      new Request('http://test', {
        method: 'POST',
        headers: { 'x-kajabi-signature': sign(body) },
        body,
      })

    userFindUnique.mockResolvedValue({ id: 'u1', user_type: 'EDUCATOR', kajabi_contact_id: 'c1' })
    kajabiEventCreate.mockResolvedValueOnce({})
    learnTagGrantCreate.mockResolvedValueOnce({})
    pointsLedgerCreate.mockResolvedValueOnce({})

    const res1 = await POST(req())
    const body1 = await res1.json()
    expect(res1.status, JSON.stringify(body1)).toBe(200)

    kajabiEventCreate.mockImplementation(() => {
      const err: any = new Error('dup')
      err.code = 'P2002'
      throw err
    })

    for (let i = 0; i < 5; i++) {
      const res = await POST(req())
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.duplicate).toBe(true)
    }

    expect(learnTagGrantCreate).toHaveBeenCalledTimes(1)
    expect(pointsLedgerCreate).toHaveBeenCalledTimes(1)
  })

  it('normalizes tag names', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const eventA = { ...baseEvent }
    const eventB = { ...baseEvent, tag: { name: 'elevate-ai-1-completed' } }

    userFindUnique.mockResolvedValue({ id: 'u1', user_type: 'EDUCATOR', kajabi_contact_id: 'c1' })
    kajabiEventCreate.mockResolvedValue({})
    learnTagGrantCreate.mockResolvedValueOnce({})
    learnTagGrantCreate.mockImplementationOnce(() => {
      const err: any = new Error('dup')
      err.code = 'P2002'
      throw err
    })
    pointsLedgerCreate.mockResolvedValue({})

    const bodyA = JSON.stringify(eventA)
    const bodyB = JSON.stringify(eventB)

    await POST(
      new Request('http://test', { method: 'POST', headers: { 'x-kajabi-signature': sign(bodyA) }, body: bodyA }),
    )
    const res2 = await POST(
      new Request('http://test', { method: 'POST', headers: { 'x-kajabi-signature': sign(bodyB) }, body: bodyB }),
    )
    const json2 = await res2.json()
    expect(json2.duplicate).toBe(true)
  })

  it('ignores unrecognized tags', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    const event = { ...baseEvent, tag: { name: 'some-other-tag' } }
    kajabiEventCreate.mockResolvedValueOnce({})

    const body = JSON.stringify(event)
    const res = await POST(
      new Request('http://test', { method: 'POST', headers: { 'x-kajabi-signature': sign(body) }, body }),
    )

    expect(res.status).toBe(202)
    expect(kajabiEventUpdate).toHaveBeenCalledWith({
      where: { event_id_tag_name_norm: { event_id: 'evt1', tag_name_norm: 'some-other-tag' } },
      data: { status: 'ignored' },
    })
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(learnTagGrantCreate).not.toHaveBeenCalled()
    expect(pointsLedgerCreate).not.toHaveBeenCalled()
  })

  it('rejects STUDENT users', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    userFindUnique.mockResolvedValue({ id: 'u1', user_type: 'STUDENT', kajabi_contact_id: 'c1' })
    kajabiEventCreate.mockResolvedValueOnce({})

    const body = JSON.stringify(baseEvent)
    const res = await POST(
      new Request('http://test', { method: 'POST', headers: { 'x-kajabi-signature': sign(body) }, body }),
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('STUDENT_NOT_ELIGIBLE')
  })

  it('queues unmatched contacts', async () => {
    const { POST } = await import('../app/api/kajabi/webhook/route')
    userFindUnique.mockResolvedValue(null)
    kajabiEventCreate.mockResolvedValueOnce({})

    const body = JSON.stringify(baseEvent)
    const res = await POST(
      new Request('http://test', { method: 'POST', headers: { 'x-kajabi-signature': sign(body) }, body }),
    )
    expect(res.status).toBe(202)
    expect(kajabiEventUpdate).toHaveBeenCalledWith({
      where: { event_id_tag_name_norm: { event_id: 'evt1', tag_name_norm: 'elevate-ai-1-completed' } },
      data: { status: 'queued_unmatched' },
    })
  })
})
