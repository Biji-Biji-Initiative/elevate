import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth mock
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'reviewer_1', role: 'reviewer' })),
  createErrorResponse: (err: unknown, status = 500) => new Response(JSON.stringify({ success: false, error: (err as Error)?.message || 'err' }), { status }),
}))

// Prisma mocks
const findUniqueMock = vi.fn()
const transactionMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: {
    submission: { findUnique: findUniqueMock },
    $transaction: transactionMock,
  },
}))

// computePoints mock
vi.mock('@elevate/logic', async () => ({
  computePoints: vi.fn(() => 20),
}))

describe('Admin submissions PATCH - point adjustment bounds', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    transactionMock.mockReset()
  })

  it('rejects pointAdjustment beyond ±20% of base', async () => {
    const { PATCH } = await import('../app/api/admin/submissions/route')

    // Pending submission
    findUniqueMock.mockResolvedValueOnce({
      id: 'sub_1', user_id: 'user_1', activity_code: 'LEARN', status: 'PENDING', payload: { provider: 'SPL', course: 'X', completedAt: new Date().toISOString() }
    })

    const body = JSON.stringify({ submissionId: 'sub_1', action: 'approve', pointAdjustment: 1000 })
    const req = new Request('http://localhost/api/admin/submissions', { method: 'PATCH', body, headers: { 'content-type': 'application/json' } })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(String(json.error)).toContain('Point adjustment')
  })
})
