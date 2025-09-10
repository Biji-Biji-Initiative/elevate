"use server"
import 'server-only'

import { headers } from 'next/headers'

import {
  BadgesListResponseSchema,
  type AdminBadge,
} from '@elevate/types/admin-api-types'

type ListResult = { badges: AdminBadge[] }

function getBaseUrl(): string {
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
    headers: {
      ...(init?.headers || {}),
      ...(cookie ? { cookie } : {}),
      accept: 'application/json',
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  })
  if (!res.ok) {
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

export async function listBadges(includeStats = true): Promise<ListResult> {
  const search = includeStats ? '?includeStats=true' : ''
  const json = await fetchJson<unknown>(`/api/admin/badges${search}`, {
    method: 'GET',
  })
  const parsed = BadgesListResponseSchema.parse(json)
  return parsed.data
}

