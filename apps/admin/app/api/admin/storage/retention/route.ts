import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { enforceUserRetention } from '@elevate/storage'

export const runtime = 'nodejs'

const RetentionSchema = z.object({
  userId: z.string(),
  days: z.coerce.number().int().min(1).max(3650).default(730), // default 24 months
})

export const POST = withApiErrorHandling(async (request: NextRequest, _context: ApiContext): Promise<NextResponse> => {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const baseLogger = await getSafeServerLogger('admin-storage-retention')
    const logger = createRequestLogger(baseLogger, request)
    try {
      const start = Date.now()
      const json = (await request.json()) as unknown
      const parsed = RetentionSchema.safeParse(json)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', parsed.error.issues?.[0]?.message || 'Invalid body'))
      }
      const { userId, days } = parsed.data
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - Number(days))
      const deleted = await enforceUserRetention(userId, cutoff)
      logger.info('Retention enforcement completed', { userId, days, deleted })
      const res = toSuccessResponse({ userId, days, deleted })
      recordApiAvailability('/api/admin/storage/retention', 'POST', 200)
      recordApiResponseTime(
        '/api/admin/storage/retention',
        'POST',
        Date.now() - start,
        200,
      )
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/storage/retention', 'POST', 500)
      recordApiResponseTime('/api/admin/storage/retention', 'POST', 0, 500)
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})
