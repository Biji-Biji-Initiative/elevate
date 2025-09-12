import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
// Use database service layer instead of direct Prisma
import {
  findKajabiEvents,
  getKajabiEventStats,
  getKajabiPointsAwarded,
} from '@elevate/db'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

function getStringField(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function getObjectField<T extends object = Record<string, unknown>>(
  obj: unknown,
  key: string,
): T | undefined {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    return v && typeof v === 'object' ? (v as T) : undefined
  }
  return undefined
}

export const GET = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  const baseLogger = await getSafeServerLogger('admin-kajabi')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      // Check admin role
      await requireRole('admin')
      // Fetch Kajabi events using service layer
      const [events, stats, pointsAwarded] = await Promise.all([
        findKajabiEvents(50),
        getKajabiEventStats(),
        getKajabiPointsAwarded(),
      ])

      const mapped = events.map((event) => {
        const received_at =
          getStringField(event, 'created_at_utc') ||
          getStringField(event, 'received_at') ||
          new Date().toISOString()
        const processed_at = getStringField(event, 'processed_at') ?? null
        const status = getStringField(event, 'status')
        const user_match = getStringField(event, 'user_match') ?? null
        const payload = getObjectField(event, 'raw') ?? getObjectField(event, 'payload') ?? {}

        return {
          id: String((event as { id: string }).id),
          received_at,
          processed_at: processed_at ?? (status && status !== 'queued_unmatched' ? new Date().toISOString() : null),
          user_match,
          payload,
        }
      })

      const logger = createRequestLogger(baseLogger, request)
      logger.info('Fetched Kajabi events', { count: mapped.length })

      const res = toSuccessResponse({
        events: mapped,
        stats: {
          ...stats,
          points_awarded: pointsAwarded,
        },
      })
      return res
    } catch (error) {
      const logger = createRequestLogger(baseLogger, request)
      logger.error('Kajabi admin list failed', error instanceof Error ? error : new Error(String(error)))
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})
