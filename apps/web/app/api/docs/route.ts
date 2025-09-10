import { createSuccessResponse } from '@elevate/http'
import { getOpenApiSpec } from '@elevate/openapi'

export const runtime = 'nodejs'

export async function GET() {
  const res = createSuccessResponse(getOpenApiSpec())
  res.headers.set('Content-Type', 'application/json')
  res.headers.set('Cache-Control', 'public, max-age=3600')
  return res
}
