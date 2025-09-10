import type { NextRequest } from 'next/server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'

export const runtime = 'nodejs'

const BodySchema = z.object({ userType: z.enum(['EDUCATOR', 'STUDENT']) })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return createErrorResponse(new Error('Unauthorized'), 401)
    const bodyUnknown: unknown = await req.json()
    const parsed = BodySchema.safeParse(bodyUnknown)
    if (!parsed.success)
      return createErrorResponse(new Error('Bad Request'), 400)

    const { userType } = parsed.data
    await prisma.user.update({
      where: { id: userId },
      data: { user_type: userType },
    })
    try {
      const client = await clerkClient()
      await client.users.updateUser(userId, {
        publicMetadata: { user_type: userType },
      })
    } catch (err) {
      console.warn('Failed to update Clerk user public metadata', err)
    }
    return createSuccessResponse({ ok: true })
  } catch (e) {
    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
