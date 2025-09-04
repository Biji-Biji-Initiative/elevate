import { NextResponse, type NextRequest } from 'next/server'


import { requireRole } from '@elevate/auth/server-helpers'
import { getRateLimitStats, resetRateLimitStats } from '@elevate/security'
import { createSuccessResponse } from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  await requireRole('admin')
  const url = new URL(request.url)
  const reset = url.searchParams.get('reset') === 'true'
  const stats = getRateLimitStats()
  if (reset) resetRateLimitStats()
  return createSuccessResponse({ stats, reset })
}
