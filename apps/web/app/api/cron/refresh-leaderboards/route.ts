import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@elevate/db/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify this is coming from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // Refresh materialized views for leaderboard consistency
    await prisma.$executeRawUnsafe('SELECT refresh_leaderboards();')

    // Optional: Clean up audit logs older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cleanupResult = await prisma.auditLog.deleteMany({
      where: { created_at: { lt: oneYearAgo } }
    });

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      message: 'Leaderboards refreshed and maintenance completed',
      cleanedUpAuditLogs: cleanupResult.count
    });
    
  } catch (error) {
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
