// Server actions for submissions
export async function reviewSubmissionAction(body: {
  submissionId: string
  action: 'approve' | 'reject'
  reviewNote?: string
  pointAdjustment?: number
}): Promise<{ message: string; pointsAwarded?: number }> {
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/submissions`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as unknown
  if (!res.ok || !json || typeof json !== 'object' || (json as any).success !== true) {
    const msg = (json && typeof json === 'object' && 'error' in json)
      ? String((json as { error?: unknown }).error)
      : `Failed to review (${res.status})`
    throw new Error(msg)
  }
  const data = (json as { data: { message: string; pointsAwarded?: number } }).data
  return data
}

export async function bulkReviewAction(body: {
  submissionIds: string[]
  action: 'approve' | 'reject'
  reviewNote?: string
}): Promise<{ processed: number; failed: number; errors: Array<{ submissionId: string; error: string }> }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/submissions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json()) as unknown
  if (!res.ok || !json || typeof json !== 'object' || (json as any).success !== true) {
    const msg = (json && typeof json === 'object' && 'error' in json)
      ? String((json as { error?: unknown }).error)
      : `Failed to bulk review (${res.status})`
    throw new Error(msg)
  }
  const data = (json as { data: { processed: number; failed: number; errors: Array<{ submissionId: string; error: string }> } }).data
  return data
}

export async function getSubmissionByIdAction(id: string): Promise<{ submission: any; evidence?: string }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const url = `${proto}://${host}/api/admin/submissions/${id}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...(cookie ? { cookie } : {}), accept: 'application/json' },
    cache: 'no-store',
  })
  const json = (await res.json()) as unknown
  if (!res.ok || !json || typeof json !== 'object' || (json as any).success !== true) {
    const msg = (json && typeof json === 'object' && 'error' in json)
      ? String((json as { error?: unknown }).error)
      : `Failed to load submission (${res.status})`
    throw new Error(msg)
  }
  const data = (json as { data: { submission: any; evidence?: string } }).data
  return data
}

export async function listSubmissionsAction(query: Record<string, string | number | undefined>)
  : Promise<{ submissions: any[]; pagination: { page: number; limit: number; total: number; pages: number } }>
{
  'use server'
  const { headers } = await import('next/headers')
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v))
  const url = `${proto}://${host}/api/admin/submissions${params.size ? `?${params.toString()}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...(cookie ? { cookie } : {}), accept: 'application/json' },
    cache: 'no-store',
  })
  const json = (await res.json()) as unknown
  if (!res.ok || !json || typeof json !== 'object' || (json as any).success !== true) {
    const msg = (json && typeof json === 'object' && 'error' in json)
      ? String((json as { error?: unknown }).error)
      : `Failed to load submissions (${res.status})`
    throw new Error(msg)
  }
  const data = (json as { data: { submissions: any[]; pagination: { page: number; limit: number; total: number; pages: number } } }).data
  return data
}

