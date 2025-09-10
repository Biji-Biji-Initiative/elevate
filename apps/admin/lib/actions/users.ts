export async function updateUserAction(body: {
  userId: string
  role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  school?: string | null
  cohort?: string | null
  name?: string
  handle?: string
}): Promise<{ message: string; user: any }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/users`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `Failed to update user (${res.status})`)
  }
  return json.data as { message: string; user: any }
}

export async function bulkUpdateUsersAction(body: {
  userIds: string[]
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
}): Promise<{ processed: number; failed: number; errors: Array<{ userId: string; error: string }> }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/users`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as any
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `Failed to bulk update users (${res.status})`)
  }
  return json.data as { processed: number; failed: number; errors: Array<{ userId: string; error: string }> }
}

