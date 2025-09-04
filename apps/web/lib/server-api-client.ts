// Re-export from consolidated package
import { auth } from '@clerk/nextjs/server'

import { ElevateAPIClient } from '@elevate/openapi/sdk'

export async function getServerApiClient() {
  const { getToken } = await auth()
  const token = await getToken().catch(() => undefined)
  
  return new ElevateAPIClient({ 
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL,
    token: token || undefined
  })
}

export type ServerAPIClient = ElevateAPIClient

