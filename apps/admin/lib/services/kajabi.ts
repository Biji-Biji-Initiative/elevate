"use server"
import 'server-only'

import { headers } from 'next/headers'

import { KajabiResponseSchema } from '@elevate/types/admin-api-types'
import { z } from 'zod'

export type KajabiList = z.infer<typeof KajabiResponseSchema>['data']

function base() {
  const h = headers()
  const cookie = h.get('cookie')
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001'
  const proto = h.get('x-forwarded-proto') || 'http'
  return { cookie, url: `${proto}://${host}` }
}

export async function getKajabiList(): Promise<KajabiList> {
  const { cookie, url } = base()
  const res = await fetch(`${url}/api/admin/kajabi`, {
    headers: { ...(cookie ? { cookie } : {}), accept: 'application/json' },
    cache: 'no-store',
  })
  const json = (await res.json()) as unknown
  if (!res.ok || !json || typeof json !== 'object' || (json as any).success !== true) {
    const msg = (json && typeof json === 'object' && 'error' in json)
      ? String((json as { error?: unknown }).error)
      : `Failed to load Kajabi (${res.status})`
    throw new Error(msg)
  }
  return (json as { data: KajabiList }).data
}

export async function getKajabiHealth(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }> {
  const { cookie, url } = base()
  const res = await fetch(`${url}/api/admin/kajabi/health`, {
    headers: { ...(cookie ? { cookie } : {}), accept: 'application/json' },
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed (${res.status})`)
  return json.data as { healthy: boolean; hasKey: boolean; hasSecret: boolean }
}

