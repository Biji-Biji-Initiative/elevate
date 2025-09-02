import { NextResponse } from 'next/server';
import { prisma } from '@elevate/db/client';
import { requireRole } from '@elevate/auth/server-helpers';

export async function GET() {
  try {
    // Check admin role
    await requireRole('admin');

    // Fetch Kajabi events
    const events = await prisma.kajabiEvent.findMany({
      orderBy: { received_at: 'desc' },
      take: 50,
    });

    // Calculate statistics
    const stats = await prisma.kajabiEvent.aggregate({
      _count: {
        id: true,
        processed_at: true,
        user_match: true,
      },
    });

    // Calculate points awarded from LEARN submissions linked to Kajabi
    const pointsResult = await prisma.pointsLedger.aggregate({
      where: {
        external_source: 'kajabi',
      },
      _sum: {
        delta_points: true,
      },
    });

    return NextResponse.json({
      events: events.map(event => ({
        id: event.id,
        received_at: event.received_at,
        processed_at: event.processed_at,
        user_match: event.user_match,
        payload: event.payload,
      })),
      stats: {
        total_events: stats._count.id,
        processed_events: stats._count.processed_at,
        matched_users: stats._count.user_match,
        unmatched_events: stats._count.id - stats._count.user_match,
        points_awarded: pointsResult._sum.delta_points || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching Kajabi data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Kajabi data' },
      { status: 500 }
    );
  }
}