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

export async function listReferrals(params: { email?: string; month?: string; limit?: number; offset?: number } = {})
  : Promise<{ referrals: ReferralRow[]; pagination: { total: number; limit: number; offset: number; pages: number } }>
{
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0
  const input = { email: params.email, month: params.month, limit, offset }
  const result = await listReferralsService(input)
  return result
}
