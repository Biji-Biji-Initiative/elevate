import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse, withApiErrorHandling, type ApiContext } from '@elevate/http'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(async (_req: NextRequest, _ctx: ApiContext) => {
  const { userId } = await auth()
  if (!userId) return createErrorResponse(new Error('Unauthorized'), 401)
  const rows = await prisma.$queryRaw<
    { user_type: string; user_type_confirmed: boolean | null; school: string | null; region: string | null }[]
  >`
    SELECT user_type, COALESCE(user_type_confirmed, false) AS user_type_confirmed, school, region
    FROM users WHERE id = ${userId}::text LIMIT 1`
  const user = rows[0]
  if (!user) return createErrorResponse(new Error('Not Found'), 404)
  return createSuccessResponse({
    userType: user.user_type,
    userTypeConfirmed: Boolean(user.user_type_confirmed),
    school: user.school,
    region: user.region,
  })
})
