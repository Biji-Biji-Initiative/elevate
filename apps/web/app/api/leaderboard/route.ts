import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const search = searchParams.get('search') ?? ''

    // Use materialized view for better performance
    let leaderboardData
    
    if (period === '30d') {
      // Query 30-day leaderboard materialized view
      leaderboardData = await prisma.$queryRaw`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY l.total_points DESC) as rank,
          u.id,
          u.handle,
          u.name,
          u.avatar_url,
          u.school,
          u.cohort,
          l.total_points as points,
          l.learn_points,
          l.explore_points,
          l.amplify_points,
          l.present_points,
          l.shine_points,
          l.submission_count
        FROM leaderboard_30d l
        JOIN users u ON l.user_id = u.id
        WHERE l.total_points > 0
          ${search ? prisma.$queryRaw`AND (
            LOWER(u.name) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(u.handle) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(u.school) LIKE LOWER(${'%' + search + '%'})
          )` : prisma.$queryRaw``}
        ORDER BY l.total_points DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else {
      // Query all-time leaderboard materialized view
      leaderboardData = await prisma.$queryRaw`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY l.total_points DESC) as rank,
          u.id,
          u.handle,
          u.name,
          u.avatar_url,
          u.school,
          u.cohort,
          l.total_points as points,
          l.learn_points,
          l.explore_points,
          l.amplify_points,
          l.present_points,
          l.shine_points,
          l.submission_count
        FROM leaderboard_totals l
        JOIN users u ON l.user_id = u.id
        WHERE l.total_points > 0
          ${search ? prisma.$queryRaw`AND (
            LOWER(u.name) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(u.handle) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(u.school) LIKE LOWER(${'%' + search + '%'})
          )` : prisma.$queryRaw``}
        ORDER BY l.total_points DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    }

    // Get total count for pagination
    const totalCountResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM ${period === '30d' ? prisma.$queryRaw`leaderboard_30d` : prisma.$queryRaw`leaderboard_totals`} l
      JOIN users u ON l.user_id = u.id
      WHERE l.total_points > 0
        ${search ? prisma.$queryRaw`AND (
          LOWER(u.name) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(u.handle) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(u.school) LIKE LOWER(${'%' + search + '%'})
        )` : prisma.$queryRaw``}
    `

    const totalCount = Number(totalCountResult[0]?.count || 0)

    // Get earned badges for users in the leaderboard
    const userIds = (leaderboardData as any[]).map(user => user.id)
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

    // Group badges by user
    const badgesByUser = badges.reduce((acc, earnedBadge) => {
      if (!acc[earnedBadge.user_id]) {
        acc[earnedBadge.user_id] = []
      }
      acc[earnedBadge.user_id].push({
        badge: earnedBadge.badge
      })
      return acc
    }, {} as Record<string, any[]>)

    // Format the response data
    const formattedData = (leaderboardData as any[]).map((user) => ({
      rank: Number(user.rank) + offset,
      user: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        school: user.school,
        cohort: user.cohort,
        avatar_url: user.avatar_url,
        earned_badges: badgesByUser[user.id] || [],
        _sum: { 
          points: Number(user.points),
          learn_points: Number(user.learn_points || 0),
          explore_points: Number(user.explore_points || 0),
          amplify_points: Number(user.amplify_points || 0),
          present_points: Number(user.present_points || 0),
          shine_points: Number(user.shine_points || 0),
          submission_count: Number(user.submission_count || 0)
        }
      }
    }))

    return NextResponse.json({
      period,
      data: formattedData,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    }, {
      headers: {
        'Cache-Control': period === '30d' ? 'public, s-maxage=300' : 'public, s-maxage=600'
      }
    })

  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    )
  }
}
