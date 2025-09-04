import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { Prisma } from '@prisma/client'

import { 
  LeaderboardQuerySchema,
  createSuccessResponse,
  createErrorResponse,
  withApiErrorHandling,
  ValidationError
} from '@elevate/types'


export const runtime = 'nodejs';

// Type definitions for leaderboard data
type LeaderboardUser = {
  rank: number;
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  school: string | null;
  cohort: string | null;
  points: number;
  learn_points: number;
  explore_points: number;
  amplify_points: number;
  present_points: number;
  shine_points: number;
  submission_count: number;
};

type UserWithBadges = {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  school: string | null;
  cohort: string | null;
  earned_badges: Array<{
    badge: {
      code: string;
      name: string;
      icon_url: string | null;
    };
  }>;
  _sum: {
    points: number;
    learn_points: number;
    explore_points: number;
    amplify_points: number;
    present_points: number;
    shine_points: number;
    submission_count: number;
  };
};

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url)
  const parsed = LeaderboardQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    throw new ValidationError(parsed.error, 'Invalid leaderboard query parameters', context.traceId)
  }
    const { period, limit, offset, search } = parsed.data

    // Use optimized materialized views for maximum performance
    const table = period === '30d' ? Prisma.sql`leaderboard_30d` : Prisma.sql`leaderboard_totals`
    const like = (v: string) => `%${v.trim()}%`
    const where = search && search.trim().length > 0
      ? Prisma.sql`WHERE name ILIKE ${like(search)} OR handle ILIKE ${like(search)} OR school ILIKE ${like(search)}`
      : Prisma.sql``

    // Get total count for pagination
    const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${table} ${where}`
    )
    const totalCount = Number(countRows?.[0]?.count ?? 0)

    if (totalCount === 0) {
      const response = createSuccessResponse({
        period,
        data: [],
        total: 0,
        limit,
        offset,
        hasMore: false
      })
      response.headers.set('Cache-Control', period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600')
      return response
    }

    // Get paginated leaderboard data with detailed breakdown using a single optimized query
    const leaderboardData = await prisma.$queryRaw<Array<{
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
    }>>(
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
            ${period === '30d' ? Prisma.sql`AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'` : Prisma.sql``}
          WHERE EXISTS (SELECT 1 FROM ${table} WHERE user_id = lb.user_id ${search && search.trim().length > 0 ? Prisma.sql`AND (name ILIKE ${like(search)} OR handle ILIKE ${like(search)} OR school ILIKE ${like(search)})` : Prisma.sql``})
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
      `
    )

    // Get badges for the users in a single query
    const userIds = leaderboardData.map(user => user.user_id)
    const badges = await prisma.earnedBadge.findMany({
      where: {
        user_id: { in: userIds }
      },
      include: {
        badge: {
          select: {
            code: true,
            name: true,
            icon_url: true
          }
        }
      }
    })

    // Group badges by user for efficient lookup
    const badgesByUser = badges.reduce<Record<string, Array<{ badge: { code: string; name: string; icon_url: string | null } }>>>((acc, earnedBadge) => {
      if (!acc[earnedBadge.user_id]) {
        acc[earnedBadge.user_id] = []
      }
      acc[earnedBadge.user_id]!.push({
        badge: earnedBadge.badge
      })
      return acc
    }, {})

    // Format final leaderboard response
    const leaderboardUsers: UserWithBadges[] = leaderboardData.map(user => ({
      id: user.user_id,
      handle: user.handle,
      name: user.name,
      avatar_url: user.avatar_url,
      school: user.school,
      cohort: user.cohort,
      earned_badges: badgesByUser[user.user_id] || [],
      _sum: {
        points: user.total_points,
        learn_points: Number(user.learn_points || 0),
        explore_points: Number(user.explore_points || 0),
        amplify_points: Number(user.amplify_points || 0),
        present_points: Number(user.present_points || 0),
        shine_points: Number(user.shine_points || 0),
        submission_count: user.public_submissions
      }
    }))

    // Format the response data with proper ranking
    const formattedData = leaderboardUsers.map((user, index) => ({
      rank: offset + index + 1,
      user
    }))

  const response = createSuccessResponse({
    period,
    data: formattedData,
    total: totalCount,
    limit,
    offset,
    hasMore: offset + limit < totalCount
  })
  response.headers.set('Cache-Control', period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600')
  return response
})
