import { describe, it, expect, vi } from 'vitest'
import { revokeSubmission } from '../revoke-submission'
import { grantBadgesForUser } from '../scoring'

vi.mock('../scoring', () => ({ grantBadgesForUser: vi.fn() }))

describe('revokeSubmission', () => {
  it('writes compensating ledger entry and updates status', async () => {
    const ledgerFind = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ delta_points: 7, event_time: new Date('2025-05-06T01:00:00Z') })
    const ledgerCreate = vi.fn().mockResolvedValue({})
    const tx = {
      submission: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 's1',
          user_id: 'u1',
          activity_code: 'AMPLIFY',
          status: 'APPROVED',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      pointsLedger: { findUnique: ledgerFind, create: ledgerCreate },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }

    await revokeSubmission(tx as any, { submissionId: 's1', actorId: 'admin1' })

    expect(tx.submission.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'REVOKED', reviewer_id: 'admin1' },
    })
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: {
        user_id: 'u1',
        activity_code: 'AMPLIFY',
        source: 'FORM',
        delta_points: -7,
        external_event_id: 'submission:s1:revoked:v1',
        event_time: new Date('2025-05-06T01:00:00Z'),
        meta: {},
      },
    })
    expect(grantBadgesForUser).toHaveBeenCalledWith(tx, 'u1')
  })

  it('is idempotent', async () => {
    const ledgerFind = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ delta_points: 5, event_time: new Date('2025-05-01T00:00:00Z') })
      .mockResolvedValueOnce({ delta_points: -5 })
    const ledgerCreate = vi.fn()
    const tx = {
      submission: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 's2',
          user_id: 'u2',
          activity_code: 'AMPLIFY',
          status: 'APPROVED',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      pointsLedger: { findUnique: ledgerFind, create: ledgerCreate },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }

    await revokeSubmission(tx as any, { submissionId: 's2', actorId: 'admin1' })
    await revokeSubmission(tx as any, { submissionId: 's2', actorId: 'admin1' })

    expect(ledgerCreate).toHaveBeenCalledTimes(1)
  })
})
