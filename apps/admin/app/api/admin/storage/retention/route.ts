import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const logger = await getSafeServerLogger('admin-storage-retention')
    try {
      const start = Date.now()
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
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
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
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
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
