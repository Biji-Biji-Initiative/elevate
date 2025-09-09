import type { NextRequest } from 'next/server';

import { requireRole } from '@elevate/auth/server-helpers';
// Use database service layer instead of direct Prisma
import { 
  findKajabiEvents,
  getKajabiEventStats,
  getKajabiPointsAwarded
} from '@elevate/db';
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    // Check admin role
    await requireRole('admin');

    // Fetch Kajabi events using service layer
    const [events, stats, pointsAwarded] = await Promise.all([
      findKajabiEvents(50),
      getKajabiEventStats(),
      getKajabiPointsAwarded()
    ]);

    return createSuccessResponse({
      events: events.map(event => ({
        id: event.id,
        received_at: event.received_at,
        processed_at: event.processed_at,
        user_match: event.user_match,
        payload: event.payload,
      })),
      stats: {
        ...stats,
        points_awarded: pointsAwarded,
      },
    })
  } catch (error) {
    return createErrorResponse(error, 500);
  }
  })
}
