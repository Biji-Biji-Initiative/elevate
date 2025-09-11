"use server"
import 'server-only'

export { listReferralsService as listReferrals } from '@/lib/server/referrals-service'

export type ReferralRow = {
  id: string
  eventType: string
  source?: string | null
  createdAt: string
  externalEventId?: string | null
  referrer: { id: string; name: string; email: string }
  referee: { id: string; name: string; email: string; user_type: 'EDUCATOR' | 'STUDENT' }
}
