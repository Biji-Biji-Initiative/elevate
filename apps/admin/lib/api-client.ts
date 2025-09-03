import ElevateAPIClient from '@elevate/openapi/sdk'

// Admin client; token can be attached by callers if needed
export function getApiClient(token?: string) {
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL || '')
  const client = new ElevateAPIClient({ 
    baseUrl, 
    ...(token !== undefined && { token })
  })
  return client
}

export type APIClient = ReturnType<typeof getApiClient>

