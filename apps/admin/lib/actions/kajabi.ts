export async function testKajabiAction(body: { user_email: string; course_name?: string })
  : Promise<{ success: boolean; message?: string; test_mode?: boolean; data?: Record<string, unknown> }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/kajabi/test`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json as { success: boolean; message?: string; test_mode?: boolean; data?: Record<string, unknown> }
}

export async function reprocessKajabiAction(body: { event_id: string }): Promise<{ message: string }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/kajabi/reprocess`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { message: string }
}

export async function inviteKajabiAction(body: { userId?: string; email?: string; name?: string; offerId?: string | number })
  : Promise<{ invited: boolean; contactId?: number; withOffer: boolean }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/kajabi/invite`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { invited: boolean; contactId?: number; withOffer: boolean }
}

export async function listKajabiAction(): Promise<{ events: any[]; stats: any }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/kajabi`
  const res = await fetch(url, { headers: { ...(cookie ? { cookie } : {}) }, cache: 'no-store' })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { events: any[]; stats: any }
}

export async function kajabiHealthAction(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/kajabi/health`
  const res = await fetch(url, { headers: { ...(cookie ? { cookie } : {}) }, cache: 'no-store' })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { healthy: boolean; hasKey: boolean; hasSecret: boolean }
}
