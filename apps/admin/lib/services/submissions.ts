"use server"
import 'server-only'

import { headers } from 'next/headers'

import {
  SubmissionsListResponseSchema,
  SubmissionDetailResponseSchema,
  CohortsResponseSchema,
  SubmissionsQuerySchema,
  type SubmissionsQuery,
  type AdminSubmission,
  type Pagination,
} from '@elevate/types/admin-api-types'

type ListResult = { submissions: AdminSubmission[]; pagination: Pagination }

function getBaseUrl(): string {
  // Build an absolute URL for server-side fetch with correct protocol
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const h = headers()
  const cookie = h.get('cookie')
  const url = `${getBaseUrl()}${path}`
  const res = await fetch(url, {
    ...init,
    // Forward cookies for authentication
    headers: {
      ...(init?.headers || {}),
      ...(cookie ? { cookie } : {}),
      accept: 'application/json',
    },
    cache: 'no-store',
    // Ensure Next recognizes this as a dynamic request
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    // Try to surface API envelope error if present
    let message = `Request failed with ${res.status}`
    try {
      const body: unknown = await res.json()
      if (
        body &&
        typeof body === 'object' &&
        'success' in body &&
        (body as { success: boolean }).success === false &&
        'error' in body
      ) {
        message = String((body as { error?: unknown }).error ?? message)
      }
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  const data: unknown = await res.json()
  return data as T
}

export async function listSubmissions(
  params: SubmissionsQuery = {},
): Promise<ListResult> {
  // Validate input first
  const validated = SubmissionsQuerySchema.parse(params)

  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(validated)) {
    if (v === undefined || v === null) continue
    search.set(k, String(v))
  }

  const json = await fetchJson<unknown>(
    `/api/admin/submissions${search.size ? `?${search.toString()}` : ''}`,
    { method: 'GET' },
  )
  const parsed = SubmissionsListResponseSchema.parse(json)
  return parsed.data
}

export async function getCohorts(): Promise<string[]> {
  const json = await fetchJson<unknown>(
    '/api/admin/meta/cohorts',
    { method: 'GET' },
  )
  const parsed = CohortsResponseSchema.parse(json)
  return parsed.data.cohorts
}

export async function getSubmissionById(id: string): Promise<{ submission: AdminSubmission; evidence?: string }>
{
  const json = await fetchJson<unknown>(
    `/api/admin/submissions/${encodeURIComponent(id)}`,
    { method: 'GET' },
  )
  const parsed = SubmissionDetailResponseSchema.parse(json)
  return parsed.data
}
