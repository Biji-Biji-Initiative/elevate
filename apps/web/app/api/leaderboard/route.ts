import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { Prisma } from '@prisma/client'

import { LeaderboardQuerySchema } from '@elevate/types'


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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = LeaderboardQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }
    const { period, limit, offset, search } = parsed.data

    // Calculate leaderboard using Prisma ORM with proper typing
    let leaderboardUsers: UserWithBadges[] = []
    let totalCount = 0
    
      // Get users based on period and search criteria
      const dateFilter = period === '30d' ? 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : 
        new Date(0)
      
      // Use materialized views for leaderboard (faster and consistent)
      const table = period === '30d' ? Prisma.sql`leaderboard_30d` : Prisma.sql`leaderboard_totals`
      const like = (v: string) => `%${v.trim()}%`
      const where = search && search.trim().length > 0
        ? Prisma.sql`WHERE name ILIKE ${like(search)} OR handle ILIKE ${like(search)} OR school ILIKE ${like(search)}`
        : Prisma.sql``

      // Count
      const countRows = await prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${table} ${where}`
      )
      totalCount = Number(countRows?.[0]?.count ?? 0)

      // Page rows
      const pageRows = await prisma.$queryRaw<Array<{ user_id: string; handle: string; name: string; avatar_url: string | null; school: string | null; cohort: string | null; total_points: number; last_activity_at: Date | null }>>(
        Prisma.sql`SELECT user_id, handle, name, avatar_url, school, cohort, total_points, last_activity_at
                   FROM ${table}
                   ${where}
                   ORDER BY total_points DESC, COALESCE(last_activity_at, '1970-01-01') DESC
                   LIMIT ${limit} OFFSET ${offset}`
      )

      // Shape to match downstream computation
      const usersWithSubmissions = pageRows.map(r => ({
        id: r.user_id,
        handle: r.handle,
        name: r.name,
        avatar_url: r.avatar_url,
        school: r.school,
        cohort: r.cohort,
      }))
      
      const userIds = usersWithSubmissions.map(u => u.id)
      
      if (userIds.length === 0) {
        totalCount = 0
        leaderboardUsers = []
      } else {
        // Get points aggregated by user and activity
        const pointsAggregation = await prisma.pointsLedger.groupBy({
          by: ['user_id', 'activity_code'],
          where: {
            user_id: { in: userIds },
            created_at: { gte: dateFilter }
          },
          _sum: {
            delta_points: true
          }
        })
        
        // Get submission counts
        const submissionCounts = await prisma.submission.groupBy({
          by: ['user_id'],
          where: {
            user_id: { in: userIds },
            status: 'APPROVED',
            visibility: 'PUBLIC',
            updated_at: { gte: dateFilter }
          },
          _count: {
            id: true
          }
        })
        
        // Calculate totals for each user
        const userTotals = usersWithSubmissions.map(user => {
          const userPoints = pointsAggregation.filter(p => p.user_id === user.id)
          const userSubmissions = submissionCounts.find(s => s.user_id === user.id)
          
          const pointsByActivity = {
            LEARN: userPoints.find(p => p.activity_code === 'LEARN')?._sum.delta_points || 0,
            EXPLORE: userPoints.find(p => p.activity_code === 'EXPLORE')?._sum.delta_points || 0,
            AMPLIFY: userPoints.find(p => p.activity_code === 'AMPLIFY')?._sum.delta_points || 0,
            PRESENT: userPoints.find(p => p.activity_code === 'PRESENT')?._sum.delta_points || 0,
            SHINE: userPoints.find(p => p.activity_code === 'SHINE')?._sum.delta_points || 0
          }
          
          const totalPoints = Object.values(pointsByActivity).reduce((sum, points) => sum + points, 0)
          
          return {
            ...user,
            totalPoints,
            learn_points: pointsByActivity.LEARN,
            explore_points: pointsByActivity.EXPLORE,
            amplify_points: pointsByActivity.AMPLIFY,
            present_points: pointsByActivity.PRESENT,
            shine_points: pointsByActivity.SHINE,
            submission_count: userSubmissions?._count.id || 0
          }
        })
        
        // Filter users with points > 0 and sort
        const filteredAndSorted = userTotals
          .filter(user => user.totalPoints > 0)
          .sort((a, b) => b.totalPoints - a.totalPoints)
        
        totalCount = filteredAndSorted.length
        
        // Apply pagination
        const paginatedUsers = filteredAndSorted.slice(offset, offset + limit)
        
        // Get badges for paginated users
        const badges = await prisma.earnedBadge.findMany({
          where: {
            user_id: { in: paginatedUsers.map(u => u.id) }
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
        
        // Group badges by user
        const badgesByUser = badges.reduce<Record<string, Array<{ badge: { code: string; name: string; icon_url: string | null } }>>>((acc, earnedBadge) => {
          if (!acc[earnedBadge.user_id]) {
            acc[earnedBadge.user_id] = []
          }
          const userBadges = acc[earnedBadge.user_id]
          if (userBadges) {
            userBadges.push({
              badge: earnedBadge.badge
            })
          }
          return acc
        }, {})
        
        // Format final result
        leaderboardUsers = paginatedUsers.map(user => ({
          id: user.id,
          handle: user.handle,
          name: user.name,
          avatar_url: user.avatar_url,
          school: user.school,
          cohort: user.cohort,
          earned_badges: badgesByUser[user.id] || [],
          _sum: {
            points: user.totalPoints,
            learn_points: user.learn_points,
            explore_points: user.explore_points,
            amplify_points: user.amplify_points,
            present_points: user.present_points,
            shine_points: user.shine_points,
            submission_count: user.submission_count
          }
        }))
      }

    // Format the response data with proper ranking
    const formattedData = leaderboardUsers.map((user, index) => ({
      rank: offset + index + 1,
      user
    }))

    return NextResponse.json({
      success: true,
      data: {
        period,
        data: formattedData,
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    }, {
      headers: {
        'Cache-Control': period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600'
      }
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard data' }, { status: 500 })
  }
}
