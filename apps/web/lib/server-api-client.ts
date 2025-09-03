import ElevateAPIClient from '@elevate/openapi/sdk'
import { auth } from '@clerk/nextjs/server'

export async function getServerApiClient() {
  const { getToken } = await auth()
  const token = await getToken().catch(() => undefined)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  return new ElevateAPIClient({ baseUrl, token })
}

