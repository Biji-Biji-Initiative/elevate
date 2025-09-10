import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth to allow reviewer role
vi.mock('@elevate/auth/server-helpers', async () => {
  return {
    requireRole: vi.fn(async () => ({
      userId: 'reviewer_1',
      role: 'reviewer',
    })),
    createErrorResponse: (err: unknown, status = 500) =>
      new Response(
        JSON.stringify({
          success: false,
          error: (err as Error)?.message || 'err',
        }),
        { status },
      ),
  }
})

// Stub computePoints to a fixed value for deterministic testing
const computePointsMock = vi.fn(() => 42)
vi.mock('@elevate/logic', async () => ({
  computePoints: (...args: unknown[]) => computePointsMock(...(args as never)),
}))

// DB/service mocks
const findUniqueMock = vi.fn()
const transactionMock = vi.fn()

// Transaction nested mocks
const txSubmissionUpdateMock = vi.fn(
  async (args: {
    data?: Record<string, unknown>
    where?: { id?: string }
  }) => ({ ...(args?.data || {}), id: args?.where?.id }),
)
const txAuditCreateMock = vi.fn(async () => ({}))
const txLedgerCreateMock = vi.fn(async () => ({}))

vi.mock('@elevate/db', async () => {
  return {
    // Service-layer helpers used by the route
    findSubmissionById: (...args: unknown[]) =>
      findUniqueMock(...(args as never)),
    // Still need prisma for transactions
    prisma: {
      $transaction: transactionMock,
    },
  }
})

describe('Admin submissions API - PATCH approve awards points', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    transactionMock.mockReset()
    txSubmissionUpdateMock.mockReset()
    txAuditCreateMock.mockReset()
    txLedgerCreateMock.mockReset()
    computePointsMock.mockClear()
  })

  it('creates a points ledger entry on approval', async () => {
    const { PATCH } = await import('../app/api/admin/submissions/route')

    // Arrange: submission exists and is PENDING (EXPLORE to trigger points)
    findUniqueMock.mockResolvedValueOnce({
      id: 'sub_123',
      user_id: 'user_1',
      activity_code: 'EXPLORE',
      status: 'PENDING',
      payload: {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'x'.repeat(160),
          class_date: '2024-01-01',
          school: 'Test School',
        },
      },
    })

    // Arrange: $transaction invokes callback with tx-like object
    transactionMock.mockImplementation(
      async (
        cb: (tx: {
          submission: { update: typeof txSubmissionUpdateMock }
          auditLog: { create: typeof txAuditCreateMock }
          pointsLedger: { create: typeof txLedgerCreateMock }
        }) => unknown,
      ) => {
        const tx = {
          submission: { update: txSubmissionUpdateMock },
          auditLog: { create: txAuditCreateMock },
          pointsLedger: { create: txLedgerCreateMock },
        }
        const result = await cb(tx)
        return result
      },
    )

    const body = JSON.stringify({ submissionId: 'sub_123', action: 'approve' })
    const req = new Request('http://localhost/api/admin/submissions', {
      method: 'PATCH',
      body,
      headers: { 'content-type': 'application/json' },
    })

    // Act
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // Assert: ledger called with computed delta
    expect(computePointsMock).toHaveBeenCalled()
    expect(txLedgerCreateMock).toHaveBeenCalledTimes(1)
    const ledgerArg = txLedgerCreateMock.mock.calls[0]?.[0]
    expect(ledgerArg).toMatchObject({
      data: {
        user_id: 'user_1',
        activity_code: 'EXPLORE',
        source: 'MANUAL',
        delta_points: 42,
        external_source: 'admin_approval',
        external_event_id: 'submission_sub_123',
      },
    })
  })
})
