import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { Prisma, prisma } from '@elevate/db'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { createSuccessResponse } from '@elevate/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Wrap in rate limiter as a light GET endpoint
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    await requireRole('admin')

    // Fetch distinct non-null cohorts
    const rows = await prisma.user.findMany({
      select: { cohort: true },
      where: { NOT: { cohort: null } },
      distinct: ['cohort'] as Prisma.UserScalarFieldEnum[],
      orderBy: { cohort: 'asc' as const },
    })

    const cohorts = rows
      .map((r) => r.cohort)
      .filter((c): c is string => !!c)

    return createSuccessResponse({ cohorts })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}
