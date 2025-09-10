import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth mock
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'reviewer_1', role: 'reviewer' })),
  createErrorResponse: (err: unknown, status = 500) =>
    new Response(
      JSON.stringify({
        success: false,
        error: (err as Error)?.message || 'err',
      }),
      { status },
    ),
}))

// DB/service mocks
const findUniqueMock = vi.fn()
const transactionMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  findSubmissionById: (...args: unknown[]) =>
    findUniqueMock(...(args as never)),
  prisma: {
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

    // Pending submission (EXPLORE to enable computePoints flow)
    findUniqueMock.mockResolvedValueOnce({
      id: 'sub_1',
      user_id: 'user_1',
      activity_code: 'EXPLORE',
      status: 'PENDING',
      payload: {
        activityCode: 'EXPLORE',
        data: { reflection: 'x'.repeat(160), class_date: '2024-01-01' },
      },
    })

    // Ensure the transaction executes the route logic
    const txSubmissionUpdateMock = vi.fn(async () => ({}))
    const txAuditCreateMock = vi.fn(async () => ({}))
    transactionMock.mockImplementation(
      async (
        cb: (tx: {
          submission: { update: typeof txSubmissionUpdateMock }
          auditLog: { create: typeof txAuditCreateMock }
        }) => unknown,
      ) => {
        const tx = {
          submission: { update: txSubmissionUpdateMock },
          auditLog: { create: txAuditCreateMock },
        }
        return cb(tx)
      },
    )

    const body = JSON.stringify({
      submissionId: 'sub_1',
      action: 'approve',
      pointAdjustment: 1000,
    })
    const req = new Request('http://localhost/api/admin/submissions', {
      method: 'PATCH',
      body,
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(String(json.error || '')).toContain('POINT_ADJUSTMENT_OUT_OF_BOUNDS')
  })
})
