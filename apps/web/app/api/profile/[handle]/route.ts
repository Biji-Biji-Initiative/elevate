import type { NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import {
  getPublicProfileByHandle,
  getTotalPointsByUserId,
  findUserByHandle,
  findSubmissionsByUserId,
  findEarnedBadgesByUserId,
} from '@elevate/db'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'
import { HandleParamSchema } from '@elevate/types'
import { mapRawUserProfileToDTO } from '@elevate/types/dto-mappers'

export const runtime = 'nodejs'

/**
 * Internal API endpoint for profile data
 * Note: This is NOT the canonical profile URL. The canonical URL is /u/[handle]
 * This API route is for internal data fetching only.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, publicApiRateLimiter, async () => {
    const start = Date.now()
    try {
      // Derive dynamic segment since Next.js route type checker is strict about arg typing
      const path = request.nextUrl.pathname
      const match = path.match(/\/api\/profile\/(.+)$/)
      const handleFromPath = match?.[1]
      const parsed = HandleParamSchema.safeParse({
        handle: handleFromPath,
      })
      if (!parsed.success) {
        recordApiAvailability('/api/profile/[handle]', 'GET', 400)
        recordApiResponseTime(
          '/api/profile/[handle]',
          'GET',
          Date.now() - start,
          400,
        )
        return createErrorResponse(new Error('Invalid handle'), 400)
      }
      const { handle } = parsed.data

      // Determine if viewer is the owner
      const { userId } = await auth()
      const targetUser = await findUserByHandle(handle)
      if (!targetUser) {
        recordApiAvailability('/api/profile/[handle]', 'GET', 404)
        recordApiResponseTime(
          '/api/profile/[handle]',
          'GET',
          Date.now() - start,
          404,
        )
        return createErrorResponse(new Error('Profile not found'), 404)
      }

      const isOwner = Boolean(userId && userId === targetUser.id)

      // Fetch profile data: owner sees all their submissions; public viewers see public+approved only
      let rawUser: {
        id: string
        handle: string
        name: string
        school: string | null
        cohort: string | null
        created_at: Date
        earned_badges: any[]
        submissions: any[]
      } | null = null

      if (isOwner) {
        const [subs, badges] = await Promise.all([
          findSubmissionsByUserId(targetUser.id),
          findEarnedBadgesByUserId(targetUser.id),
        ])
        rawUser = {
          id: targetUser.id,
          handle: targetUser.handle,
          name: targetUser.name,
          school: targetUser.school ?? null,
          cohort: targetUser.cohort ?? null,
          created_at: targetUser.created_at,
          earned_badges: badges || [],
          submissions: (subs || []).map((s) => ({
            id: s.id,
            activity_code: s.activity_code,
            activity: s.activity,
            status: s.status,
            visibility: s.visibility,
            payload: (s as any).payload ?? {},
            created_at: s.created_at,
            updated_at: s.updated_at,
          })),
        }
      } else {
        const userPublic = await getPublicProfileByHandle(handle)
        if (!userPublic || !userPublic.submissions) {
          recordApiAvailability('/api/profile/[handle]', 'GET', 404)
          recordApiResponseTime(
            '/api/profile/[handle]',
            'GET',
            Date.now() - start,
            404,
          )
          return createErrorResponse(
            new Error('Profile not found or not public'),
            404,
          )
        }
        rawUser = {
          id: userPublic.id,
          handle: userPublic.handle,
          name: userPublic.name,
          school: userPublic.school ?? null,
          cohort: userPublic.cohort ?? null,
          created_at: userPublic.created_at,
          earned_badges: userPublic.earned_badges || [],
          submissions: (userPublic.submissions || []).map((s) => ({
            id: s.id,
            activity_code: s.activity_code,
            activity: s.activity,
            status: s.status,
            visibility: s.visibility,
            payload: (s as any).payload ?? {},
            created_at: s.created_at,
            updated_at: s.updated_at,
          })),
        }
      }

      const totalPoints = await getTotalPointsByUserId(targetUser.id)

      // Transform to DTO format
      const profileData = mapRawUserProfileToDTO({
        id: rawUser.id,
        handle: rawUser.handle,
        name: rawUser.name,
        school: rawUser.school,
        cohort: rawUser.cohort,
        created_at: rawUser.created_at,
        _sum: { points: Number(totalPoints || 0) },
        earned_badges: rawUser.earned_badges || [],
        submissions: rawUser.submissions || [],
      })

      const response = createSuccessResponse(profileData)
      response.headers.set('Cache-Control', 'public, s-maxage=300')
      recordApiAvailability('/api/profile/[handle]', 'GET', 200)
      recordApiResponseTime(
        '/api/profile/[handle]',
        'GET',
        Date.now() - start,
        200,
      )
      return response
    } catch (_error) {
      recordApiAvailability('/api/profile/[handle]', 'GET', 500)
      recordApiResponseTime(
        '/api/profile/[handle]',
        'GET',
        Date.now() - start,
        500,
      )
      return createErrorResponse(new Error('Failed to fetch profile data'), 500)
    }
  })
}
