import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'

export const runtime = 'nodejs'

function makeCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < 8; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return createErrorResponse(new Error('Unauthorized'), 401)

    // Use raw SQL to include optional column ref_code not present in Prisma types
    const rows = await prisma.$queryRaw<
      { id: string; handle: string | null; ref_code: string | null }[]
    >`
      SELECT id, handle, ref_code FROM users WHERE id = ${userId}::text LIMIT 1
    `
    let user = rows[0] || null
    if (!user) return createErrorResponse(new Error('User not found'), 404)

    if (!user.ref_code) {
      // Generate unique ref code
      for (let i = 0; i < 5; i++) {
        const code = makeCode()
        const exists = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM users WHERE ref_code = ${code} LIMIT 1
        `
        if (!Array.isArray(exists) || exists.length === 0) {
          // Use parameterized query binding to avoid runtime errors
          await prisma.$executeRaw`
            UPDATE users SET ref_code = ${code} WHERE id = ${user.id}
          `
          user = { ...user, ref_code: code }
          break
        }
      }
      if (!user.ref_code) {
        return createErrorResponse(
          new Error('Failed to allocate ref code'),
          500,
        )
      }
    }

    // Construct link using ref_code (preferred)
    const origin = process.env.NEXT_PUBLIC_SITE_URL || ''
    const qs = (await import('@/lib/utils/query')).buildQueryString({ ref: user.ref_code })
    const link = origin ? `${origin}/?${qs}` : `/?${qs}`
    return createSuccessResponse({ refCode: user.ref_code, link })
  } catch (e) {
    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
