import { type NextRequest, type NextResponse } from 'next/server'

// Use database service layer and DTO transformations
import { Prisma } from '@prisma/client'

import { findEarnedBadgesByUserIds, prisma } from '@elevate/db'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { LeaderboardQuerySchema } from '@elevate/types'
import {
  mapRawLeaderboardEntryToDTO,
  type LeaderboardEntryDTO,
} from '@elevate/types/dto-mappers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
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
        ? Prisma.sql`WHERE name ILIKE ${like(search)} OR handle ILIKE ${like(
            search,
          )} OR school ILIKE ${like(search)}`
        : Prisma.sql``

    // Get total count for pagination
    const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${table} ${where}`,
    )
    const totalCount = Number(countRows?.[0]?.count ?? 0)

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
    const leaderboardData = await prisma.$queryRaw<
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
          ? Prisma.sql`AND (name ILIKE ${like(search)} OR handle ILIKE ${like(
              search,
            )} OR school ILIKE ${like(search)})`
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
          COALESCE(lb.total_points, 0)::int AS total_points,
          COALESCE(lb.public_submissions, 0)::int AS public_submissions,
          lb.last_activity_at,
          COALESCE(ap.learn_points, 0)::int AS learn_points,
          COALESCE(ap.explore_points, 0)::int AS explore_points,
          COALESCE(ap.amplify_points, 0)::int AS amplify_points,
          COALESCE(ap.present_points, 0)::int AS present_points,
          COALESCE(ap.shine_points, 0)::int AS shine_points
        FROM ${table} lb
        JOIN activity_points ap ON lb.user_id = ap.user_id
        ${where}
        ORDER BY lb.total_points DESC, COALESCE(lb.last_activity_at, '1970-01-01'::timestamp) DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    )

    // Get badges for the users in a single query
    const userIds = leaderboardData.map((user) => user.user_id)
    const badges = await findEarnedBadgesByUserIds(userIds)

    // Group badges by user for efficient lookup
    const badgesByUser = badges.reduce<
      Record<
        string,
        Array<{
          badge: { code: string; name: string; icon_url: string | null }
        }>
      >
    >((acc, earnedBadge) => {
      if (!acc[earnedBadge.user_id]) {
        acc[earnedBadge.user_id] = []
      }
      acc[earnedBadge.user_id].push({
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
            points: user.total_points,
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
    return response
  } catch (error) {
    return createErrorResponse(
      new Error('Failed to fetch leaderboard data'),
      500,
    )
  }
}
