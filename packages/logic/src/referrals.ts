import { ReferralError } from '@elevate/types'

export interface ReferralEvent {
  referrerUserId: string
  refereeUserId: string
  createdAt: Date
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function assertReferralAllowed(
  referrerUserId: string,
  refereeUserId: string,
  events: ReferralEvent[],
  now: Date = new Date(),
): void {
  if (referrerUserId === refereeUserId) {
    throw new ReferralError('SELF_REFERRAL')
  }
  const cutoff = new Date(now.getTime() - THIRTY_DAYS_MS)
  const circular = events.some(
    (e) =>
      e.referrerUserId === refereeUserId &&
      e.refereeUserId === referrerUserId &&
      e.createdAt >= cutoff,
  )
  if (circular) {
    throw new ReferralError('CIRCULAR_REFERRAL')
  }
}

