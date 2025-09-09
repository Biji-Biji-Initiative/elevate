import { describe, it, expect, vi } from 'vitest'
import { approveAmplifySubmission } from '../amplify'
import { grantBadgesForUser } from '../scoring'

vi.mock('../scoring', () => ({ grantBadgesForUser: vi.fn() }))

describe('approveAmplifySubmission', () => {
  it('awards points and writes ledger with event time', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      submission: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      pointsLedger: {
        create: vi.fn().mockResolvedValue({}),
      },
    }

    const result = await approveAmplifySubmission(tx as any, {
      submissionId: 's1',
      userId: 'u1',
      payload: {
        peers_trained: 2,
        students_trained: 3,
        session_date: '2025-05-06',
        session_start_time: '08:00',
        location: { city: 'Jakarta' },
      },
      orgTimezone: 'Asia/Jakarta',
      caps: { peersPer7d: 50, studentsPer7d: 200 },
    })

    expect(result.warnings).toEqual([])
    expect(tx.$queryRaw).toHaveBeenCalled()
    expect(tx.submission.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        status: 'APPROVED',
        reviewer_id: undefined,
        approval_org_timezone: 'Asia/Jakarta',
      },
    })
    expect(tx.pointsLedger.create).toHaveBeenCalledWith({
      data: {
        user_id: 'u1',
        activity_code: 'AMPLIFY',
        source: 'FORM',
        delta_points: 7,
        external_event_id: 'submission:s1:approved:v1',
        event_time: new Date('2025-05-06T01:00:00.000Z'),
        meta: {},
      },
    })
    expect(grantBadgesForUser).toHaveBeenCalledWith(tx, 'u1')
  })

  it('enforces 7-day caps', async () => {
    const existing = [
      {
        payload: {
          peers_trained: 9,
          students_trained: 0,
          session_date: '2025-05-03',
          session_start_time: '10:00',
          location: { city: 'Jakarta' },
        },
      },
    ]
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      submission: {
        findMany: vi.fn().mockResolvedValue(existing),
        update: vi.fn(),
      },
      pointsLedger: { create: vi.fn() },
    }

    await expect(
      approveAmplifySubmission(tx as any, {
        submissionId: 's2',
        userId: 'u1',
        payload: {
          peers_trained: 2,
          students_trained: 1,
          session_date: '2025-05-06',
          session_start_time: '09:00',
          location: { city: 'Jakarta' },
        },
        orgTimezone: 'Asia/Jakarta',
        caps: { peersPer7d: 10, studentsPer7d: 10 },
      }),
    ).rejects.toThrow('Peer training')
  })

  it('flags duplicate sessions', async () => {
    const existing = [
      {
        payload: {
          peers_trained: 1,
          students_trained: 1,
          session_date: '2025-05-06',
          session_start_time: '09:30',
          location: { city: 'Jakarta' },
        },
      },
    ]
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      submission: {
        findMany: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({}),
      },
      pointsLedger: { create: vi.fn().mockResolvedValue({}) },
    }

    const result = await approveAmplifySubmission(tx as any, {
      submissionId: 's3',
      userId: 'u1',
      payload: {
        peers_trained: 1,
        students_trained: 1,
        session_date: '2025-05-06',
        session_start_time: '10:00',
        location: { city: 'Jakarta' },
      },
      orgTimezone: 'Asia/Jakarta',
      caps: { peersPer7d: 10, studentsPer7d: 10 },
    })

    expect(result.warnings).toContain('DUPLICATE_SESSION_SUSPECT')
  })

  it('warns when start time missing', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      submission: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      pointsLedger: { create: vi.fn().mockResolvedValue({}) },
    }

    const result = await approveAmplifySubmission(tx as any, {
      submissionId: 's4',
      userId: 'u1',
      payload: {
        peers_trained: 1,
        students_trained: 1,
        session_date: '2025-05-06',
        location: { city: 'Jakarta' },
      },
      orgTimezone: 'Asia/Jakarta',
      caps: { peersPer7d: 10, studentsPer7d: 10 },
    })

    expect(result.warnings).toContain('MISSING_SESSION_START_TIME')
  })
})
