import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import type { ErrorEnvelope } from '@elevate/types'

export const runtime = 'nodejs'

function errorResponse(status: number, envelope: ErrorEnvelope) {
  return NextResponse.json({ error: envelope }, { status })
}

export async function GET(_request: NextRequest) {
  try {
    const [learners, amplifySubs, storiesShared, microCredentials] = await Promise.all([
      prisma.learnTagGrant.groupBy({
        by: ['user_id'],
        where: { user: { user_type: 'EDUCATOR' } },
      }),
      prisma.submission.findMany({
        where: {
          activity_code: 'AMPLIFY',
          status: 'APPROVED',
          user: { user_type: 'EDUCATOR' },
        },
        select: { payload: true },
      }),
      prisma.submission.count({
        where: {
          activity_code: 'PRESENT',
          status: 'APPROVED',
          user: { user_type: 'EDUCATOR' },
        },
      }),
      prisma.learnTagGrant.count({ where: { user: { user_type: 'EDUCATOR' } } }),
    ])

    let peers = 0
    let students = 0
    for (const sub of amplifySubs) {
      const data: any = sub.payload
      peers += data.peers_trained ?? 0
      students += data.students_trained ?? 0
    }

    const body = {
      success: true,
      data: {
        counters: {
          educators_learning: learners.length,
          peers_students_reached: peers + students,
          stories_shared: storiesShared,
          micro_credentials: microCredentials,
          mce_certified: 0,
        },
      },
    }
    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=60',
      },
    })
  } catch (_err) {
    return errorResponse(500, {
      type: 'state',
      code: 'STATS_FETCH_FAILED',
      message: 'Failed to fetch statistics',
    })
  }
}
