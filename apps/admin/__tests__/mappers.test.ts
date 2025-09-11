import { describe, it, expect } from 'vitest'

import { toAdminSubmission, toAdminBadge, toAdminUser, toReferralRow, toKajabiEvent, type SubmissionRow, type BadgeRow, type AdminUserRow, type ReferralEventRow } from '@/lib/server/mappers'
import { toRecentSubmission, toRecentApproval, toRecentUser, toReviewerPerformance, toTopBadgeStat } from '@/lib/server/mappers'

describe('server mappers', () => {
  it('toAdminSubmission maps core fields', () => {
    const now = new Date('2025-01-02T03:04:05.000Z')
    const row = {
      id: 's1',
      created_at: now,
      updated_at: null,
      user_id: 'u1',
      activity_code: 'BUILD',
      status: 'PENDING',
      visibility: 'PRIVATE',
      review_note: null,
      points_awarded: null,
      payload: { sample: true },
      reviewer_id: null,
      reviewed_at: null,
      user: { id: 'u1', name: 'Alice', email: 'a@e.com', handle: 'alice', school: null, cohort: 'C1' },
      activity: { code: 'BUILD', name: 'Build', id: 'a1', default_points: 10, created_at: now, updated_at: now } as any,
      attachments_rel: [{ id: 'att1', submission_id: 's1', path: '/x', hash: null, created_at: now }],
    } as unknown as SubmissionRow

    const dto = toAdminSubmission(row)
    expect(dto.id).toBe('s1')
    expect(dto.created_at).toBe(now.toISOString())
    expect(dto.attachmentCount).toBe(1)
    expect(dto.user.id).toBe('u1')
    expect(dto.activity.code).toBe('BUILD')
  })

  it('toRecentSubmission normalizes activity/status and dates', () => {
    const created = new Date('2025-04-01T00:00:00.000Z')
    const out = toRecentSubmission({ id: 's1', activity_code: 'LEARN', created_at: created, status: 'PENDING', user: { name: 'Alice' } })
    expect(out.id).toBe('s1')
    expect(out.activity_code).toBe('LEARN')
    expect(out.status).toBe('PENDING')
    expect(out.created_at).toBe(created.toISOString())
  })

  it('toRecentApproval normalizes reviewer/user, points and dates', () => {
    const updated = new Date('2025-04-02T00:00:00.000Z')
    const out = toRecentApproval({ id: 's2', activity_code: 'BUILD', updated_at: updated, points_awarded: 20, reviewer: { name: 'R' }, user: { name: 'U' } })
    expect(out.activity_code).toBe('BUILD')
    expect(out.reviewer_name).toBe('R')
    expect(out.user_name).toBe('U')
    expect(out.approved_at).toBe(updated.toISOString())
    expect(out.points_awarded).toBe(20)
  })

  it('toRecentUser normalizes name and date', () => {
    const created = new Date('2025-05-01T12:34:56.000Z')
    const out = toRecentUser({ id: 'u1', name: null, created_at: created, cohort: null })
    expect(out.name).toBe('')
    expect(out.created_at).toBe(created.toISOString())
  })

  it('toReviewerPerformance computes approval rate/avg', () => {
    const out = toReviewerPerformance({ id: 'r1', name: 'Rev', total: 10, approved: 7, avgReviewTimeHours: 1.5 })
    expect(out.reviewCount).toBe(10)
    expect(out.approvalRate).toBeCloseTo(0.7)
    expect(out.avgReviewTimeHours).toBe(1.5)
  })

  it('toTopBadgeStat maps earned counts and unique earners', () => {
    const out = toTopBadgeStat({ code: 'EARLY', name: 'Early', earnedCount: 5, uniqueEarners: 3 })
    expect(out.code).toBe('EARLY')
    expect(out.earnedCount).toBe(5)
    expect(out.uniqueEarners).toBe(3)
  })

  it('toAdminBadge maps with stats', () => {
    const when = new Date('2025-01-02T00:00:00.000Z')
    const row = {
      code: 'EARLY',
      name: 'Early Bird',
      description: 'Awarded for early actions',
      criteria: { type: 'points', threshold: 100 },
      icon_url: null,
      created_at: when,
      updated_at: when,
      _count: { earned_badges: 2 },
      earned_badges: [
        { id: 'eb1', user_id: 'u1', badge_code: 'EARLY', earned_at: when, user: { id: 'u1', name: 'Alice', handle: 'alice' } as any },
        { id: 'eb2', user_id: 'u2', badge_code: 'EARLY', earned_at: when, user: { id: 'u2', name: 'Bob', handle: 'bob' } as any },
      ],
    } as unknown as BadgeRow

    const dto = toAdminBadge(row, { includeStats: true })
    expect(dto.code).toBe('EARLY')
    expect(dto._count?.earned_badges).toBe(2)
    expect(dto.earned_badges?.[0]?.user.id).toBe('u1')
  })

  it('toAdminUser includes totals and counts', () => {
    const when = new Date('2025-02-01T00:00:00.000Z')
    const row = {
      id: 'u1',
      handle: 'alice',
      name: 'Alice',
      email: 'a@e.com',
      avatar_url: null,
      role: 'PARTICIPANT',
      user_type: 'EDUCATOR',
      user_type_confirmed: true,
      kajabi_contact_id: null,
      school: null,
      cohort: 'C1',
      created_at: when,
      _count: { submissions: 3, ledger: 5, earned_badges: 2 },
    } as unknown as AdminUserRow

    const dto = toAdminUser(row, 42)
    expect(dto.id).toBe('u1')
    expect(dto.totalPoints).toBe(42)
    expect(dto._count.earned_badges).toBe(2)
  })

  it('toReferralRow maps nested relations', () => {
    const when = new Date('2025-01-15T12:00:00.000Z')
    const row = {
      id: 'r1',
      referrer_user_id: 'u1',
      referee_user_id: 'u2',
      event_type: 'signup',
      external_event_id: 'ext1',
      source: 'cookie',
      created_at: when,
      referrer: { id: 'u1', name: 'Alice', email: 'a@e.com' } as any,
      referee: { id: 'u2', name: 'Bob', email: 'b@e.com', user_type: 'STUDENT' } as any,
    } as unknown as ReferralEventRow

    const dto = toReferralRow(row)
    expect(dto.id).toBe('r1')
    expect(dto.referee.user_type).toBe('STUDENT')
    expect(dto.createdAt).toBe(when.toISOString())
  })

  it('toKajabiEvent maps raw fields', () => {
    const when = new Date('2025-03-01T00:00:00.000Z')
    const row = {
      id: 'k1',
      event_id: 'evt_1',
      tag_name_raw: 'LEARN_COMPLETED',
      tag_name_norm: 'LEARN_COMPLETED',
      contact_id: 'c1',
      email: 'a@e.com',
      created_at_utc: when,
      status: 'processed',
      raw: { user_match: 'u1', data: { contact: { email: 'a@e.com' }, tag: { name: 'x' } } },
    } as any
    const dto = toKajabiEvent(row)
    expect(dto.id).toBe('k1')
    expect(dto.user_match).toBe('u1')
    expect(dto.received_at).toBe(when.toISOString())
  })
})
