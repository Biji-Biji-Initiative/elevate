import type { NextRequest } from 'next/server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { enrollUserInKajabi } from '@elevate/integrations'

export const runtime = 'nodejs'

const BodySchema = z.object({
  userType: z.enum(['EDUCATOR', 'STUDENT']),
  school: z.string().optional(),
  region: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return createErrorResponse(new Error('Unauthorized'), 401)
  const bodyUnknown: unknown = await req.json()
  const parsed = BodySchema.safeParse(bodyUnknown)
  if (!parsed.success) return createErrorResponse(new Error('Bad Request'), 400)
  const { userType, school, region } = parsed.data

  if (userType === 'EDUCATOR' && (!school || !region)) {
    return createErrorResponse(new Error('School and region are required for Educators'), 400)
  }

  try {
    // Update Clerk publicMetadata first
    try {
      const client = await clerkClient()
      await client.users.updateUser(userId, {
        publicMetadata: { user_type: userType },
      })
    } catch {
      // Clerk update is best-effort; continue if it fails
    }

    // Mirror to DB and confirm
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        user_type: userType,
        user_type_confirmed: true,
        ...(userType === 'EDUCATOR'
          ? { school: school || null, region: region || null }
          : {}),
      },
      select: { id: true, email: true, name: true, kajabi_contact_id: true },
    })

    // Educators only: enroll in Kajabi after confirmation (best-effort)
    if (userType === 'EDUCATOR') {
      try {
        const email = updated.email || ''
        const name = updated.name || email.split('@')[0] || 'Educator'
        const offerId = process.env.KAJABI_OFFER_ID
        const result = await enrollUserInKajabi(email, name, {
          ...(offerId ? { offerId } : {}),
        })
        if (result.success && result.contactId && !updated.kajabi_contact_id) {
          await prisma.user.update({
            where: { id: updated.id },
            data: { kajabi_contact_id: String(result.contactId) },
          })
        }
      } catch {
        // Ignore enrollment errors here
      }
    }

    return createSuccessResponse({ ok: true })
  } catch (e) {
    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
