import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../packages/db/client'

interface RouteParams {
  params: {
    handle: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { handle } = params

    // Mock data - in production this would query the database
    if (handle === 'siti_nurhaliza') {
      const mockProfile = {
        id: '1',
        handle: 'siti_nurhaliza',
        name: 'Siti Nurhaliza',
        email: 'siti@example.com',
        school: 'SMA Negeri 1 Jakarta',
        cohort: 'Jakarta 2024',
        created_at: '2024-01-15T08:00:00Z',
        _sum: { points: 185 },
        earned_badges: [
          {
            badge: {
              code: 'LEARN_MASTER',
              name: 'Learn Master',
              description: 'Completed multiple learning courses',
            },
            earned_at: '2024-02-01T10:00:00Z'
          },
          {
            badge: {
              code: 'EXPLORER',
              name: 'Explorer',
              description: 'Successfully applied AI tools in classroom',
            },
            earned_at: '2024-03-15T14:30:00Z'
          }
        ],
        submissions: [
          {
            id: '1',
            activity_code: 'LEARN',
            activity: { name: 'Learn', code: 'LEARN' },
            status: 'APPROVED',
            visibility: 'PUBLIC',
            payload: {
              provider: 'ILS',
              course: 'AI in Education Fundamentals',
              completedAt: '2024-02-01'
            },
            created_at: '2024-02-01T08:00:00Z',
            updated_at: '2024-02-01T12:00:00Z'
          }
        ]
      }

      return NextResponse.json(mockProfile, {
        headers: {
          'Cache-Control': 'public, s-maxage=300' // Cache for 5 minutes
        }
      })
    }

    // Profile not found
    return NextResponse.json(
      { error: 'Profile not found or not public' },
      { status: 404 }
    )

    // In production, you would use something like this:
    /*
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
            badge: {
              select: {
                code: true,
                name: true,
                description: true,
                icon_url: true
              }
            },
            earned_at: true
          }
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
        },
        _sum: {
          points: true
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Profile not found or not public' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
    */

  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    )
  }
}