import type { NextRequest, NextResponse } from 'next/server'

import { clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const BulkLeapsUpdateSchema = z
  .object({
    userIds: z.array(z.string()).min(1),
    userType: z.enum(['EDUCATOR', 'STUDENT']).optional(),
    userTypeConfirmed: z.boolean().optional(),
    school: z.string().optional(),
    region: z.string().optional(),
  })
  .refine((v) => !!v.userType || typeof v.userTypeConfirmed === 'boolean' || v.school !== undefined || v.region !== undefined, {
    message: 'Provide at least one field to update',
  })

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const start = Date.now()
    const logger = await getSafeServerLogger('admin-users-leaps-bulk')
    try {
      const json: unknown = await request.json()
      const parsed = BulkLeapsUpdateSchema.safeParse(json)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', parsed.error.issues?.[0]?.message || 'Invalid body'))
      }
  const { userIds, userType, userTypeConfirmed, school, region } = parsed.data

      // Limit bulk operations to prevent abuse
      if (userIds.length > 100) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk operation'))
      }

      const results = { processed: 0, failed: 0, errors: [] as Array<{ userId: string; error: string }> }

      for (const id of userIds) {
        try {
          const updated = await prisma.user.update({
            where: { id },
            data: {
              ...(userType ? { user_type: userType } : {}),
              ...(typeof userTypeConfirmed === 'boolean' ? { user_type_confirmed: userTypeConfirmed } : {}),
              ...(school !== undefined ? { school } : {}),
              ...(region !== undefined ? { region } : {}),
            },
            select: { id: true },
          })
          if (userType) {
            try {
              const client = await clerkClient()
              await client.users.updateUser(updated.id, { publicMetadata: { user_type: userType } })
            } catch (e) {
              logger.warn('Clerk mirror failed for user', { id, error: e instanceof Error ? e.message : String(e) })
            }
          }
          results.processed += 1
        } catch (e) {
          results.failed += 1
          results.errors.push({ userId: id, error: e instanceof Error ? e.message : String(e) })
        }
      }

      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const res = toSuccessResponse(results)
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      recordApiAvailability('/api/admin/users/leaps', 'POST', 200)
      recordApiResponseTime('/api/admin/users/leaps', 'POST', Date.now() - start, 200)
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/users/leaps', 'POST', 500)
      recordApiResponseTime('/api/admin/users/leaps', 'POST', Date.now() - start, 500)
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
