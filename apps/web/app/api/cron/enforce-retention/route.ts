import { type NextRequest, type NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { enforceUserRetention } from '@elevate/storage'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseLogger = await getSafeServerLogger('enforce-retention')
  const logger = baseLogger.forRequestWithHeaders
    ? baseLogger.forRequestWithHeaders(request)
    : baseLogger

  // Auth via cron secret
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expectedAuth) {
    return createErrorResponse(new Error('Unauthorized'), 401)
  }

  try {
    const start = Date.now()
    const url = new URL(request.url)
    const daysParam = url.searchParams.get('days')
    const days = Math.max(1, Math.min(3650, Number(daysParam || '730')))
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // Optional paging
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || '200')))
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'))

    const users = await prisma.user.findMany({
      select: { id: true },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset,
    })

    let deletedTotal = 0
    for (const u of users) {
      try {
        const deleted = await enforceUserRetention(u.id, cutoff)
        deletedTotal += deleted
      } catch (e) {
        logger.warn('Retention error for user', { userId: u.id, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const res = createSuccessResponse({
      processedUsers: users.length,
      deletedFiles: deletedTotal,
      days,
      nextOffset: offset + users.length,
    })
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    recordApiAvailability('/api/cron/enforce-retention', 'GET', 200)
    recordApiResponseTime('/api/cron/enforce-retention', 'GET', Date.now() - start, 200)
    return res
  } catch (error) {
    recordApiAvailability('/api/cron/enforce-retention', 'GET', 500)
    recordApiResponseTime('/api/cron/enforce-retention', 'GET', 0, 500)
    return createErrorResponse(new Error('Failed to enforce retention'), 500)
  }
}
