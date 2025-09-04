// Re-export from consolidated package
import { ElevateAPIClient } from '@elevate/openapi'

export function getApiClient(token?: string) {
  return new ElevateAPIClient({ 
    baseUrl: typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_SITE_URL,
    token 
  })
}

export type APIClient = ElevateAPIClient

