"use server"
import 'server-only'

import type { ReferralsQuery } from '@/lib/server/referrals-service'

export async function listReferrals(params: ReferralsQuery) {
  const { listReferralsService } = await import('@/lib/server/referrals-service')
  return listReferralsService(params)
}

export type ReferralRow = {
  id: string
  eventType: string
  source?: string | null
  createdAt: string
  externalEventId?: string | null
  referrer: { id: string; name: string; email: string }
  referee: { id: string; name: string; email: string; user_type: 'EDUCATOR' | 'STUDENT' }
}
