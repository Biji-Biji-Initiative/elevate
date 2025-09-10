// Use the generated SDK client via the main package
import { ElevateAPIClient } from '@elevate/openapi'

export function getApiClient(token?: string) {
  // Client-side: empty baseUrl uses same-origin relative paths
  if (typeof window !== 'undefined') {
    const opts: { baseUrl: string; token?: string } = { baseUrl: '' }
    if (typeof token === 'string') opts.token = token
    return new ElevateAPIClient(opts)
  }
  // Server-side fallback: prefer env, else keep empty (will be fixed by getServerApiClient)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const opts: { baseUrl: string; token?: string } = { baseUrl }
  if (typeof token === 'string') opts.token = token
  return new ElevateAPIClient(opts)
}

export async function getServerApiClient(token?: string) {
  // Server-only helper: build absolute origin from incoming headers
  try {
    const mod = await import('next/headers')
    const h = await (
      mod as { headers: () => Promise<Headers> | Headers }
    ).headers()
    const proto = h.get('x-forwarded-proto') || 'http'
    const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
    const baseUrl = `${proto}://${host}`
    const opts: { baseUrl: string; token?: string } = { baseUrl }
    if (typeof token === 'string') opts.token = token
    return new ElevateAPIClient(opts)
  } catch {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const opts: { baseUrl: string; token?: string } = { baseUrl: fallback }
    if (typeof token === 'string') opts.token = token
    return new ElevateAPIClient(opts)
  }
}

export type APIClient = ElevateAPIClient
