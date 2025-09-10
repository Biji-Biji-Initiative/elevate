import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { enrollUserInKajabi } from '@elevate/integrations'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const InviteRequestSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    offerId: z.union([z.string(), z.number()]).optional(),
  })
  .refine((v) => !!v.userId || !!v.email, {
    message: 'userId or email is required',
  })

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const logger = await getSafeServerLogger('admin-kajabi-invite')
    try {
      const start = Date.now()
      const json = (await request.json()) as unknown
      const parsed = InviteRequestSchema.safeParse(json)
      if (!parsed.success) {
        return createErrorResponse(
          new Error(parsed.error.issues?.[0]?.message || 'Invalid body'),
          400,
        )
      }
      const {
        userId,
        email: emailInput,
        name: nameInput,
        offerId,
      } = parsed.data

      // Resolve user
      let user = null as null | {
        id: string
        email: string
        name: string | null
      }
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true },
        })
        if (!user) return createErrorResponse(new Error('User not found'), 404)
      } else if (emailInput) {
        const found = await prisma.user.findUnique({
          where: { email: emailInput.toLowerCase() },
          select: { id: true, email: true, name: true },
        })
        if (found) user = found
      }

      const email = (user?.email || emailInput || '').toLowerCase()
      const name: string =
        (nameInput || user?.name || email.split('@')[0]) ?? ''
      if (!email) return createErrorResponse(new Error('Email required'), 400)

      const effectiveOfferId = offerId ?? process.env.KAJABI_OFFER_ID

      // Execute enrollment + optional offer grant
      const result = await enrollUserInKajabi(email, name, {
        ...(effectiveOfferId !== undefined
          ? { offerId: effectiveOfferId }
          : {}),
      })

      // Upsert Kajabi contact id onto user if we have a user record
      if (user && result.success && result.contactId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { kajabi_contact_id: String(result.contactId) },
        })
      }

      const meta: Prisma.InputJsonValue = {
        email,
        name,
        offer_id: effectiveOfferId ?? null,
        granted: !!effectiveOfferId && result.success,
        contact_id: result.contactId ?? null,
        error: result.error,
      }
      await prisma.auditLog.create({
        data: {
          actor_id: 'admin',
          action: result.success
            ? 'KAJABI_INVITE_SENT'
            : 'KAJABI_INVITE_FAILED',
          target_id: user?.id ?? email,
          meta,
        },
      })

      if (!result.success) {
        logger.warn('Kajabi invite failed', { email, error: result.error })
        recordApiAvailability('/api/admin/kajabi/invite', 'POST', 502)
        recordApiResponseTime('/api/admin/kajabi/invite', 'POST', Date.now() - start, 502)
        return createErrorResponse(
          new Error(result.error || 'Kajabi invite failed'),
          502,
        )
      }

      logger.info('Kajabi invite sent', {
        email,
        contactId: result.contactId,
        withOffer: !!effectiveOfferId,
      })
      const res = createSuccessResponse({
        invited: true,
        contactId: result.contactId,
        withOffer: !!effectiveOfferId,
      })
      recordApiAvailability('/api/admin/kajabi/invite', 'POST', 200)
      recordApiResponseTime('/api/admin/kajabi/invite', 'POST', Date.now() - start, 200)
      return res
    } catch (error) {
      recordApiAvailability('/api/admin/kajabi/invite', 'POST', 500)
      recordApiResponseTime('/api/admin/kajabi/invite', 'POST', 0, 500)
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
