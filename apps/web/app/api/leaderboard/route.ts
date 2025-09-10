import { type NextRequest, type NextResponse } from 'next/server'

// Use database service layer and DTO transformations

import { Prisma } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import {
  createSuccessResponse,
  createErrorResponse,
  withApiErrorHandling,
  type ApiContext,
} from '@elevate/http'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'
import { LeaderboardQuerySchema } from '@elevate/types'
import {
  mapRawLeaderboardEntryToDTO,
  type LeaderboardEntryDTO,
} from '@elevate/types/dto-mappers'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(
  async (request: NextRequest, _context: ApiContext): Promise<NextResponse> => {
    return withRateLimit(request, publicApiRateLimiter, async () => {
      const start = Date.now()
      try {
        const { searchParams } = new URL(request.url)
        const parsed = LeaderboardQuerySchema.safeParse(
          Object.fromEntries(searchParams),
        )
        if (!parsed.success) {
          return createErrorResponse(
            new Error('Invalid leaderboard query parameters'),
            400,
          )
        }
        const { period, limit, offset, search } = parsed.data

        // Use optimized materialized views for maximum performance
        const table =
          period === '30d'
            ? Prisma.sql`leaderboard_30d`
            : Prisma.sql`leaderboard_totals`
        const like = (v: string) => `%${v.trim()}%`
        const where =
          search && search.trim().length > 0
            ? Prisma.sql`WHERE name ILIKE ${like(
                search,
              )} OR handle ILIKE ${like(search)} OR school ILIKE ${like(
                search,
              )}`
            : Prisma.sql``

        // Get total count for pagination
        let totalCount = 0
        try {
          const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
            Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${table} ${where}`,
          )
          totalCount = Number(countRows?.[0]?.count ?? 0)
          // Guard against NaN cases when casting from bigint in some drivers
          if (!Number.isFinite(totalCount)) totalCount = 0
        } catch {
          // If COUNT fails (e.g., view missing columns locally), continue with zero
          totalCount = 0
        }

        if (totalCount === 0) {
          const response = createSuccessResponse({
            period,
            data: [],
            total: 0,
            limit,
            offset,
            hasMore: false,
          })
          response.headers.set(
            'Cache-Control',
            period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600',
          )
          return response
        }

        // Get paginated leaderboard data with detailed breakdown using a single optimized query
        const leaderboardData = await prisma
          .$queryRaw<
            Array<{
              user_id: string
              handle: string
              name: string
              avatar_url: string | null
              school: string | null
              cohort: string | null
              total_points: number
              public_submissions: number
              last_activity_at: Date | null
              learn_points: number | null
              explore_points: number | null
              amplify_points: number | null
              present_points: number | null
              shine_points: number | null
            }>
          >(
            Prisma.sql`
        WITH activity_points AS (
          SELECT 
            lb.user_id,
            COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.activity_code = 'LEARN'), 0) as learn_points,
            COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.activity_code = 'EXPLORE'), 0) as explore_points,
            COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.activity_code = 'AMPLIFY'), 0) as amplify_points,
            COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.activity_code = 'PRESENT'), 0) as present_points,
            COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.activity_code = 'SHINE'), 0) as shine_points
          FROM ${table} lb
          LEFT JOIN points_ledger pl ON lb.user_id = pl.user_id
            ${
              period === '30d'
                ? Prisma.sql`AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'`
                : Prisma.sql``
            }
          WHERE EXISTS (SELECT 1 FROM ${table} WHERE user_id = lb.user_id ${
              search && search.trim().length > 0
                ? Prisma.sql`AND (name ILIKE ${like(
                    search,
                  )} OR handle ILIKE ${like(search)} OR school ILIKE ${like(
                    search,
                  )})`
                : Prisma.sql``
            })
          GROUP BY lb.user_id
        )
        SELECT 
          lb.user_id,
          lb.handle,
          lb.name,
          lb.avatar_url,
          lb.school,
          lb.cohort,
          lb.total_points,
          lb.public_submissions,
          lb.last_activity_at,
          ap.learn_points,
          ap.explore_points,
          ap.amplify_points,
          ap.present_points,
          ap.shine_points
        FROM ${table} lb
        JOIN activity_points ap ON lb.user_id = ap.user_id
        ${where}
        ORDER BY lb.total_points DESC, COALESCE(lb.last_activity_at, '1970-01-01'::timestamp) DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
          )
          .catch(() => [])

        // Get badges for the users in a single query (inline to reduce coupling during local dev)
        const userIds = leaderboardData.map((user) => user.user_id)
        const badges = userIds.length
          ? await prisma.earnedBadge.findMany({
              where: { user_id: { in: userIds } },
              include: { badge: true },
              orderBy: { earned_at: 'desc' },
            })
          : []

        // Group badges by user for efficient lookup
        const badgesByUser = badges.reduce<
          Record<
            string,
            Array<{
              badge: { code: string; name: string; icon_url: string | null }
            }>
          >
        >((acc, earnedBadge) => {
          const list =
            acc[earnedBadge.user_id] ?? (acc[earnedBadge.user_id] = [])
          list.push({
            badge: {
              code: earnedBadge.badge.code,
              name: earnedBadge.badge.name,
              icon_url: earnedBadge.badge.icon_url,
            },
          })
          return acc
        }, {})

        // Format the response data using DTO mappers
        const formattedData: LeaderboardEntryDTO[] = leaderboardData.map(
          (user, index) =>
            mapRawLeaderboardEntryToDTO(offset + index + 1, {
              id: user.user_id,
              handle: user.handle,
              name: user.name,
              avatar_url: user.avatar_url,
              school: user.school,
              earned_badges: badgesByUser[user.user_id] || [],
              _sum: {
                // Cast to number to avoid BigInt serialization errors
                points: Number(user.total_points ?? 0),
              },
            }),
        )

        const response = createSuccessResponse({
          period,
          data: formattedData,
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        })
        response.headers.set(
          'Cache-Control',
          period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600',
        )
        recordApiAvailability('/api/leaderboard', 'GET', 200)
        recordApiResponseTime(
          '/api/leaderboard',
          'GET',
          Date.now() - start,
          200,
        )
        return response
      } catch (error) {
        recordApiAvailability('/api/leaderboard', 'GET', 500)
        recordApiResponseTime(
          '/api/leaderboard',
          'GET',
          Date.now() - start,
          500,
        )
        return createErrorResponse(
          error instanceof Error
            ? error
            : new Error('Failed to fetch leaderboard data'),
          500,
        )
      }
    })
  },
)
