import type { NextRequest } from 'next/server'

import { z } from 'zod'

import { prisma } from '@elevate/db'
import {
  withApiErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  type ApiContext,
} from '@elevate/http'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'
import { parsePresentPayload } from '@elevate/types'

export const runtime = 'nodejs'

// Cache for 5 minutes since stories don't change frequently
export const revalidate = 300

export const GET = withApiErrorHandling(
  async (request: NextRequest, _context: ApiContext) => {
    return withRateLimit(request, publicApiRateLimiter, async () => {
      const url = new URL(request.url)
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '12'),
        50,
      )
      const offset = Math.max(
        parseInt(url.searchParams.get('offset') || '0'),
        0,
      )

      // Get public, approved PRESENT submissions with user and badge info
      const stories = await prisma.submission.findMany({
        where: {
          activity_code: 'PRESENT',
          status: 'APPROVED',
          visibility: 'PUBLIC',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
              school: true,
              earned_badges: {
                select: {
                  badge_code: true,
                  badge: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
                orderBy: { earned_at: 'desc' },
                take: 1, // Get the most recent badge
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
        skip: offset,
      })

      // Transform to safe public format
      const publicStories = stories.map((story) => {
        // Payload in DB is snake_case; accept both shapes defensively
        const raw: unknown = story.payload
        const present =
          parsePresentPayload({ activityCode: 'PRESENT', data: raw }) || null

        const isRecord = (v: unknown): v is Record<string, unknown> =>
          !!v && typeof v === 'object' && !Array.isArray(v)
        const payload = isRecord(raw) ? raw : {}

        const getString = (
          obj: Record<string, unknown>,
          key: string,
        ): string | undefined => {
          const v = obj[key]
          return typeof v === 'string' ? v : undefined
        }

        // Extract safe fields (prefer validated present.data, fallback to raw payload)
        const linkedinUrl =
          present?.data.linkedin_url ??
          getString(payload, 'linkedin_url') ??
          getString(payload, 'linkedinUrl') ??
          ''
        const caption =
          present?.data.caption ?? getString(payload, 'caption') ?? ''
        const screenshotFile =
          present?.data.screenshot_url ??
          getString(payload, 'screenshot_url') ??
          getString(payload, 'screenshotUrl') ??
          ''

        // Determine school/region display
        const schoolRegion = story.user.school || 'Indonesia'

        // Get the most recent badge
        const latestBadge = story.user.earned_badges[0]?.badge

        return {
          id: story.id,
          imageUrl: screenshotFile ? `/api/files/${screenshotFile}` : undefined,
          schoolRegion,
          challenge: caption || 'AI Implementation Story',
          aiTool: 'AI Tools', // Generic since we don't have specific tool info in PRESENT
          resultMetric: 'Shared on LinkedIn',
          linkedinUrl,
          badgeCode: latestBadge?.code,
          badgeName: latestBadge?.name,
          createdAt: story.created_at,
        }
      })

      // Validate the public stories output shape defensively
      const StorySchema = z.object({
        id: z.string(),
        imageUrl: z.string().optional(),
        schoolRegion: z.string(),
        challenge: z.string(),
        aiTool: z.string(),
        resultMetric: z.string(),
        linkedinUrl: z.string().optional(),
        badgeCode: z.string().optional(),
        badgeName: z.string().optional(),
        createdAt: z.union([z.string(), z.date()]),
      })
      const StoriesResponseSchema = z.object({
        stories: z.array(StorySchema),
        pagination: z.object({
          limit: z.number().int(),
          offset: z.number().int(),
          total: z.number().int(),
          hasMore: z.boolean(),
        }),
      })

      // Get total count for pagination
      const totalCount = await prisma.submission.count({
        where: {
          activity_code: 'PRESENT',
          status: 'APPROVED',
          visibility: 'PUBLIC',
        },
      })

      const payload = {
        stories: publicStories,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount,
        },
      }
      const parsed = StoriesResponseSchema.safeParse(payload)
      if (!parsed.success) {
        return createErrorResponse(new Error('Failed to format stories'), 500)
      }
      return createSuccessResponse(parsed.data)
    })
  },
)
