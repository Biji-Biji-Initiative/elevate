import type { NextRequest, NextResponse } from 'next/server'

import { clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'


import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const UpdateBodySchema = z
  .object({
    userType: z.enum(['EDUCATOR', 'STUDENT']).optional(),
    userTypeConfirmed: z.boolean().optional(),
    school: z.string().min(1).max(255).optional().or(z.literal('').transform(() => undefined)),
    region: z.string().min(1).max(255).optional().or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRateLimit(_request, adminRateLimiter, async () => {
    await requireRole('admin')
    const start = Date.now()
    const logger = await getSafeServerLogger('admin-users')
    try {
      const { id } = await params
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          handle: true,
          user_type: true,
          user_type_confirmed: true,
          school: true,
          region: true,
          kajabi_contact_id: true,
          created_at: true,
        },
      })
      if (!user) return createErrorResponse(new Error('User not found'), 404)
      const res = createSuccessResponse({ user })
      recordApiAvailability('/api/admin/users/[id]', 'GET', 200)
      recordApiResponseTime('/api/admin/users/[id]', 'GET', Date.now() - start, 200)
      return res
    } catch (error) {
      logger.error('GET admin user failed', error instanceof Error ? error : new Error(String(error)))
      recordApiAvailability('/api/admin/users/[id]', 'GET', 500)
      recordApiResponseTime('/api/admin/users/[id]', 'GET', Date.now() - start, 500)
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const start = Date.now()
    const logger = await getSafeServerLogger('admin-users')
    try {
      const json: unknown = await request.json()
      const parsed = UpdateBodySchema.safeParse(json)
      if (!parsed.success) {
        return createErrorResponse(
          new Error(parsed.error.issues?.[0]?.message || 'Invalid body'),
          400,
        )
      }
      const { userType, userTypeConfirmed, school, region } = parsed.data

      // Ensure user exists
      const { id } = await params
      const existing = await prisma.user.findUnique({ where: { id } })
      if (!existing) return createErrorResponse(new Error('User not found'), 404)

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(userType ? { user_type: userType } : {}),
          ...(typeof userTypeConfirmed === 'boolean' ? { user_type_confirmed: userTypeConfirmed } : {}),
          ...(school !== undefined ? { school } : {}),
          ...(region !== undefined ? { region } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          handle: true,
          user_type: true,
          user_type_confirmed: true,
          school: true,
          region: true,
          kajabi_contact_id: true,
          created_at: true,
        },
      })

      // Best-effort: mirror user_type to Clerk public metadata
      if (userType) {
        try {
          const client = await clerkClient()
          await client.users.updateUser(id, {
            publicMetadata: { user_type: userType },
          })
        } catch (e) {
          logger.warn('Failed to update Clerk public metadata for user', {
            userId: id,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }

      const res = createSuccessResponse({ user: updated })
      recordApiAvailability('/api/admin/users/[id]', 'PATCH', 200)
      recordApiResponseTime('/api/admin/users/[id]', 'PATCH', Date.now() - start, 200)
      return res
    } catch (error) {
      logger.error('PATCH admin user failed', error instanceof Error ? error : new Error(String(error)))
      recordApiAvailability('/api/admin/users/[id]', 'PATCH', 500)
      recordApiResponseTime('/api/admin/users/[id]', 'PATCH', Date.now() - start, 500)
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
