export async function fetchReferralsAction(params: { email?: string; month?: string; limit?: number; offset?: number } = {})
  : Promise<{ referrals: any[]; pagination: { total: number; limit: number; offset: number; pages: number } }>
{
  'use server'
  const { headers } = await import('next/headers')
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
  return json.data as { referrals: any[]; pagination: { total: number; limit: number; offset: number; pages: number } }
}

