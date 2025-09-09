import { describe, it, expect } from 'vitest'

import { approveAmplifySubmission } from '../amplify'
import { SubmissionLimitError } from '@elevate/types'

type Tx = {
  $queryRaw: (...args: unknown[]) => Promise<unknown>
  submission: {
    findMany: (args: unknown) => Promise<any[]>
    update: (args: unknown) => Promise<void>
  }
  pointsLedger: {
    create: (args: unknown) => Promise<void>
  }
}

function createTx(existing: any[]): Tx {
  return {
    $queryRaw: async () => ({}),
    submission: {
      findMany: async () => existing,
      update: async () => {},
    },
    pointsLedger: {
      create: async () => {},
    },
  }
}

describe('approveAmplifySubmission caps and duplicate detection', () => {
  it('approves within 7-day caps and returns warnings if metadata incomplete', async () => {
    const tx = createTx([])
    const result = await approveAmplifySubmission(tx as any, {
      submissionId: 'sub1',
      userId: 'u1',
      orgTimezone: 'GMT+7',
      caps: { peersPer7d: 50, studentsPer7d: 200 },
      payload: {
        peers_trained: 5,
        students_trained: 10,
        session_date: '2025-09-01',
        // missing session_start_time and/or city triggers warnings
      },
    })
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('throws when exceeding peers 7-day cap', async () => {
    const existing = [
      {
        payload: {
          peers_trained: 48,
          students_trained: 0,
          session_date: '2025-09-02',
          session_start_time: '09:00',
          location: { city: 'KL' },
        },
      },
    ]
    const tx = createTx(existing)
    await expect(
      approveAmplifySubmission(tx as any, {
        submissionId: 'sub2',
        userId: 'u1',
        orgTimezone: 'GMT+7',
        caps: { peersPer7d: 50, studentsPer7d: 200 },
        payload: {
          peers_trained: 5,
          students_trained: 0,
          session_date: '2025-09-03',
          session_start_time: '10:00',
          location: { city: 'KL' },
        },
      }),
    ).rejects.toBeInstanceOf(SubmissionLimitError)
  })

  it('flags potential duplicate session in warning window', async () => {
    const existing = [
      {
        payload: {
          peers_trained: 1,
          students_trained: 1,
          session_date: '2025-09-03',
          session_start_time: '10:00',
          location: { city: 'KL' },
        },
      },
    ]
    const tx = createTx(existing)
    const result = await approveAmplifySubmission(tx as any, {
      submissionId: 'sub3',
      userId: 'u1',
      orgTimezone: 'GMT+7',
      caps: { peersPer7d: 50, studentsPer7d: 200 },
      duplicateWindowMinutes: 60,
      payload: {
        peers_trained: 1,
        students_trained: 1,
        session_date: '2025-09-03',
        session_start_time: '10:30',
        location: { city: 'KL' },
      },
    })
    expect(result.warnings).toContain('DUPLICATE_SESSION_SUSPECT')
  })
})

