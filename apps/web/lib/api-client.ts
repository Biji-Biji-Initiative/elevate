import ElevateAPIClient from '@elevate/openapi/sdk'

// Factory returning a preconfigured API client for same-origin calls
export function getApiClient() {
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL || '')
  return new ElevateAPIClient({ baseUrl })
}

export type APIClient = ReturnType<typeof getApiClient>

