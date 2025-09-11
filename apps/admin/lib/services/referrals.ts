"use server"
import 'server-only'

import { listReferralsService } from '@/lib/server/referrals-service'

export type ReferralRow = {
  id: string
  eventType: string
  source?: string | null
  createdAt: string
  externalEventId?: string | null
  referrer: { id: string; name: string; email: string }
  referee: { id: string; name: string; email: string; user_type: 'EDUCATOR' | 'STUDENT' }
}

export async function listReferrals(params: { email?: string; referrerId?: string; refereeId?: string; month?: string; limit?: number; offset?: number } = {}) {
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0
  return listReferralsService({ email: params.email, referrerId: params.referrerId, refereeId: params.refereeId, month: params.month, limit, offset })
}
