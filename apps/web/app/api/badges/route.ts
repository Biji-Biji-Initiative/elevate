import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({ badges })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch badges data' },
      { status: 500 }
    )
  }
}
