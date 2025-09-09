import { type NextRequest, type NextResponse } from 'next/server'

import { getPublicProfileByHandle, getTotalPointsByUserId } from '@elevate/db'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { HandleParamSchema } from '@elevate/types'
import { mapRawUserProfileToDTO } from '@elevate/types/dto-mappers'


export const runtime = 'nodejs';

/**
 * Internal API endpoint for profile data
 * Note: This is NOT the canonical profile URL. The canonical URL is /u/[handle]
 * This API route is for internal data fetching only.
 */

export async function GET(request: NextRequest, { params }: { params: { handle: string } }): Promise<NextResponse> {
  try {
    const raw = params
    const parsed = HandleParamSchema.safeParse(raw)
    if (!parsed.success) return createErrorResponse(new Error('Invalid handle'), 400)
    const { handle } = parsed.data

    // Query user by handle using service layer
    const user = await getPublicProfileByHandle(handle)

    if (!user) return createErrorResponse(new Error('Profile not found or not public'), 404)

    // Check if user has any public submissions
    if (!user.submissions || user.submissions.length === 0) {
      return createErrorResponse(new Error('Profile not found or not public'), 404)
    }

    // Calculate total points from points_ledger using service layer
    const totalPoints = await getTotalPointsByUserId(user.id)

    // Transform to DTO format
    const profileData = mapRawUserProfileToDTO({
      id: user.id,
      handle: user.handle,
      name: user.name,
      school: user.school,
      cohort: user.cohort,
      created_at: user.created_at,
      _sum: { points: totalPoints },
      earned_badges: user.earned_badges || [],
      submissions: user.submissions || []
    })

    const response = createSuccessResponse(profileData)
    response.headers.set('Cache-Control', 'public, s-maxage=300')
    return response

  } catch (error) {
    return createErrorResponse(new Error('Failed to fetch profile data'), 500)
  }
}
