import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { HandleParamSchema, apiError, apiSuccess } from '@elevate/types'

export const runtime = 'nodejs';

/**
 * Internal API endpoint for profile data
 * Note: This is NOT the canonical profile URL. The canonical URL is /u/[handle]
 * This API route is for internal data fetching only.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const raw = await params
    const parsed = HandleParamSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(apiError('Invalid handle'), { status: 400 })
    }
    const { handle } = parsed.data

    // Query user by handle
    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        school: true,
        cohort: true,
        created_at: true,
        earned_badges: {
          select: {
            badge_code: true,
            badge: {
              select: {
                code: true,
                name: true,
                description: true,
                icon_url: true
              }
            },
            earned_at: true
          },
          orderBy: { earned_at: 'desc' }
        },
        submissions: {
          where: {
            status: 'APPROVED',
            visibility: 'PUBLIC'
          },
          select: {
            id: true,
            activity_code: true,
            activity: {
              select: { name: true, code: true }
            },
            status: true,
            visibility: true,
            payload: true,
            created_at: true,
            updated_at: true
          },
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!user) {
      return NextResponse.json(apiError('Profile not found or not public'), { status: 404 })
    }

    // Check if user has any public submissions
    if (user.submissions.length === 0) {
      return NextResponse.json(
        apiError('Profile not found or not public'),
        { status: 404 }
      )
    }

    // Calculate total points from points_ledger
    const pointsResult = await prisma.pointsLedger.aggregate({
      where: { user_id: user.id },
      _sum: { delta_points: true }
    })

    const totalPoints = pointsResult._sum.delta_points || 0

    // Format response
    const profileData = {
      id: user.id,
      handle: user.handle,
      name: user.name,
      school: user.school,
      cohort: user.cohort,
      created_at: user.created_at,
      _sum: { points: totalPoints },
      earned_badges: user.earned_badges,
      submissions: user.submissions
    }

    return NextResponse.json(apiSuccess(profileData), {
      headers: {
        'Cache-Control': 'public, s-maxage=300' // Cache for 5 minutes
      }
    })

  } catch (error) {
    return NextResponse.json(apiError('Failed to fetch profile data'), { status: 500 })
  }
}
