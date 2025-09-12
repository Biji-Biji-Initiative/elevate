"use server"
import 'server-only'

import type { ReferralsQuery } from '@/lib/server/referrals-service'
import { listReferralsService } from '@/lib/server/referrals-service'

export type ReferralsPagination = { total: number; limit: number; offset: number; pages: number }

export async function listReferrals(params: ReferralsQuery): Promise<{ referrals: ReferralRow[]; pagination: ReferralsPagination }> {
  const svc = listReferralsService as unknown as (p: ReferralsQuery) => Promise<{ referrals: ReferralRow[]; pagination: ReferralsPagination }>
  const out = await svc(params)
  return out
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
