"use server"
import 'server-only'

import { headers } from 'next/headers'

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
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const url = `${proto}://${host}/api/admin/referrals${qs.size ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { ...(cookie ? { cookie } : {}) }, cache: 'no-store' })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { referrals: ReferralRow[]; pagination: { total: number; limit: number; offset: number; pages: number } }
}

