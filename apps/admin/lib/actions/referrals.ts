'use server'
import { headers } from 'next/headers'

import { listReferralsService, referralsMonthlySummaryService } from '@/lib/server/referrals-service'
import type { ReferralRow } from '@/lib/services/referrals'

export async function fetchReferralsAction(
  params: { referrerId?: string; refereeId?: string; email?: string; month?: string; limit?: number; offset?: number } = {},
): Promise<{ referrals: ReferralRow[]; pagination: { total: number; limit: number; offset: number; pages: number } }> {
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0
  return listReferralsService({ referrerId: params.referrerId, refereeId: params.refereeId, email: params.email, month: params.month, limit, offset })
}

export async function fetchReferralsSummaryAction(month: string) {
  // headers() kept to preserve server action boundary in Next 15 RSC
  await headers()
  return referralsMonthlySummaryService(month)
}
