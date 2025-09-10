export async function createBadgeAction(body: {
  code: string
  name: string
  description: string
  criteria: unknown
  icon_url?: string
}): Promise<{ message: string }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/badges`
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

export async function updateBadgeAction(body: {
  code: string
  name?: string
  description?: string
  criteria?: unknown
  icon_url?: string
}): Promise<{ message: string }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/badges`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { message: string }
}

export async function deleteBadgeAction(code: string): Promise<{ message: string }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/badges?code=${encodeURIComponent(code)}`
  const res = await fetch(url, { method: 'DELETE', headers: { ...(cookie ? { cookie } : {}) } })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { message: string }
}

export async function assignBadgeAction(body: { badgeCode: string; userIds: string[]; reason?: string })
  : Promise<{ message: string; processed?: number; failed?: number }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/badges/assign`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { message: string; processed?: number; failed?: number }
}

export async function removeBadgeAction(body: { badgeCode: string; userIds: string[]; reason?: string })
  : Promise<{ message: string; processed?: number; failed?: number }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/badges/assign`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { message: string; processed?: number; failed?: number }
}

