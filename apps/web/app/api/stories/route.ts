import type { NextRequest } from 'next/server'

import { prisma } from '@elevate/db'
import { withApiErrorHandling, createSuccessResponse, type ApiContext } from '@elevate/http'
import { parsePresentPayload } from '@elevate/types'

export const runtime = 'nodejs'

// Cache for 5 minutes since stories don't change frequently
export const revalidate = 300

export const GET = withApiErrorHandling(
  async (request: NextRequest, _context: ApiContext) => {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '12'), 50)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0)

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
      const present = parsePresentPayload(story.payload)

      // Extract safe fields from payload
      const linkedinUrl = present?.data.linkedinUrl || ''
      const caption = present?.data.caption || ''
      const screenshotFile = present?.data.screenshotFile || ''

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

    // Get total count for pagination
    const totalCount = await prisma.submission.count({
      where: {
        activity_code: 'PRESENT',
        status: 'APPROVED',
        visibility: 'PUBLIC',
      },
    })

    return createSuccessResponse({
      stories: publicStories,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    })
  },
)
