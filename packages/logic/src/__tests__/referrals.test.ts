import { describe, expect, it } from 'vitest'
import { assertReferralAllowed, type ReferralEvent } from '../referrals'
import { ReferralError } from '@elevate/types'

describe('assertReferralAllowed', () => {
  const now = new Date('2024-05-01T00:00:00Z')
  const recent = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
  const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

  it('throws on self-referral', () => {
    try {
      assertReferralAllowed('a', 'a', [], now)
      expect.fail('expected throw')
    } catch (err) {
      expect((err as ReferralError).code).toBe('SELF_REFERRAL')
    }
  })

  it('throws on circular referral within 30 days', () => {
    const events: ReferralEvent[] = [{
      referrerUserId: 'b',
      refereeUserId: 'a',
      createdAt: recent,
    }]
    try {
      assertReferralAllowed('a', 'b', events, now)
      expect.fail('expected throw')
    } catch (err) {
      expect((err as ReferralError).code).toBe('CIRCULAR_REFERRAL')
    }
  })

  it('allows circular referral after 30 days', () => {
    const events: ReferralEvent[] = [{
      referrerUserId: 'b',
      refereeUserId: 'a',
      createdAt: old,
    }]
    expect(() => assertReferralAllowed('a', 'b', events, now)).not.toThrow()
  })

  it('allows unrelated referral', () => {
    expect(() => assertReferralAllowed('a', 'b', [], now)).not.toThrow()
  })
})

