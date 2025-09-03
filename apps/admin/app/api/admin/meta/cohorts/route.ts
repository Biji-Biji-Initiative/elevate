import { NextResponse, NextRequest } from 'next/server'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
// TODO: Re-enable when @elevate/security package is available
// import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // TODO: Re-enable rate limiting when @elevate/security package is available
  // Wrap in rate limiter as a light GET endpoint
  // return withRateLimit(request, adminRateLimiter, async () => {
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

    return NextResponse.json({ success: true, data: { cohorts } })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  // TODO: Re-enable rate limiting when @elevate/security package is available
  // })
}
