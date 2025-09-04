import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import { 
  createSuccessResponse,
  withApiErrorHandling,
  AuthenticationError
} from '@elevate/types'

export const runtime = 'nodejs';

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

    // Get authenticated user's earned badges
    const earnedBadges = await prisma.earnedBadge.findMany({
      where: { user_id: userId },
      include: {
        badge: {
          select: {
            code: true,
            name: true,
            description: true,
            icon_url: true,
            criteria: true
          }
        }
      },
      orderBy: { earned_at: 'desc' }
    })

    const badges = earnedBadges.map(eb => ({
      code: eb.badge_code,
      name: eb.badge.name,
      description: eb.badge.description,
      iconUrl: eb.badge.icon_url,
      criteria: eb.badge.criteria,
      earnedAt: eb.earned_at
    }))

  return createSuccessResponse({ badges })
})
