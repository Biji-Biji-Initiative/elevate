import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@elevate/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify this is coming from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    
    // Refresh materialized views
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW leaderboard_totals;');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW leaderboard_30d;');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW metric_counts;');
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      message: 'Leaderboards refreshed successfully'
    });
    
  } catch (error) {
    console.error('Failed to refresh leaderboards:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}