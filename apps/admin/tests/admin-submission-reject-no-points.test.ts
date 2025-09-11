import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth mock (reviewer)
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'reviewer_1', role: 'reviewer' })),
  createErrorResponse: (err: unknown, status = 500) =>
    new Response(
      JSON.stringify({ success: false, error: (err as Error)?.message || 'err' }),
      { status },
    ),
}))

// DB/service mocks
const findUniqueMock = vi.fn()
const transactionMock = vi.fn()
const txSubmissionUpdateMock = vi.fn(async (args: { where?: { id?: string }; data?: Record<string, unknown> }) => ({ ...(args?.data || {}), id: args?.where?.id }))
const txAuditCreateMock = vi.fn(async () => ({}))
const txLedgerCreateMock = vi.fn(async () => ({}))

vi.mock('@elevate/db', async () => ({
  findSubmissionById: (...args: unknown[]) => findUniqueMock(...(args as never)),
  prisma: {
    $transaction: transactionMock,
  },
}))

describe('Admin submissions PATCH - reject does not award points', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    transactionMock.mockReset()
    txSubmissionUpdateMock.mockReset()
    txAuditCreateMock.mockReset()
    txLedgerCreateMock.mockReset()
  })

  it('updates submission to REJECTED and does not create points ledger entry', async () => {
    const { PATCH } = await import('../app/api/admin/submissions/route')

    // Pending submission (any activity)
    findUniqueMock.mockResolvedValueOnce({
      id: 'sub_reject_1',
      user_id: 'user_1',
      activity_code: 'EXPLORE',
      status: 'PENDING',
      payload: { activityCode: 'EXPLORE', data: { reflection: 'x'.repeat(160) } },
    })

    // Wire up transaction context
    type Tx = {
      submission: { update: typeof txSubmissionUpdateMock }
      auditLog: { create: typeof txAuditCreateMock }
      pointsLedger: { create: typeof txLedgerCreateMock }
    }
    transactionMock.mockImplementation(async (cb: (tx: Tx) => unknown) => {
      const tx = {
        submission: { update: txSubmissionUpdateMock },
        auditLog: { create: txAuditCreateMock },
        pointsLedger: { create: txLedgerCreateMock },
      } satisfies Tx
      return cb(tx)
    })

    const body = JSON.stringify({ submissionId: 'sub_reject_1', action: 'reject', reviewNote: 'insufficient evidence' })
    const req = new Request('http://localhost/api/admin/submissions', {
      method: 'PATCH',
      body,
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // Ensure submission update occurred
    expect(txSubmissionUpdateMock).toHaveBeenCalled()
    const updateArg = txSubmissionUpdateMock.mock.calls[0]?.[0]
    expect(updateArg?.data?.status).toBe('REJECTED')

    // Ensure no points ledger entry created
    expect(txLedgerCreateMock).not.toHaveBeenCalled()
  })
})
