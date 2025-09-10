// Use the single source of truth SDK
import { ElevateAPIClient } from '@elevate/openapi/sdk'

export function getApiClient(token?: string) {
  const baseUrl =
    typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_SITE_URL || ''
  const init: { baseUrl?: string; token?: string } = {}
  if (baseUrl) init.baseUrl = baseUrl
  if (token) init.token = token
  return new ElevateAPIClient(init)
}

export async function getServerApiClient(token?: string) {
  try {
    const mod = await import('next/headers')
    const h = await (
      mod as { headers: () => Promise<Headers> | Headers }
    ).headers()
    const proto = h.get('x-forwarded-proto') || 'http'
    const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
    const baseUrl = `${proto}://${host}`
    const init: { baseUrl?: string; token?: string } = { baseUrl }
    if (token) init.token = token
    return new ElevateAPIClient(init)
  } catch {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const init: { baseUrl?: string; token?: string } = { baseUrl: fallback }
    if (token) init.token = token
    return new ElevateAPIClient(init)
  }
}

export type APIClient = ElevateAPIClient

// Test helper to inspect base URL in unit tests without using `any`
export function __debugGetBaseUrl(client: ElevateAPIClient): string {
  const obj: unknown = client
  if (obj && typeof obj === 'object' && 'baseUrl' in obj) {
    const v = (obj as { baseUrl?: unknown }).baseUrl
    return typeof v === 'string' ? v : ''
  }
  return ''
}
