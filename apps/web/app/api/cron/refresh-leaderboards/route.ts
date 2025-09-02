import { NextRequest, NextResponse } from 'next/server';
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
    
    // Perform database maintenance tasks with Prisma
    // Since we're using real-time Prisma queries instead of materialized views,
    // we can use this endpoint for other maintenance tasks
    
    // Example: Clean up old audit logs (older than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const cleanupResult = await prisma.auditLog.deleteMany({
      where: {
        created_at: {
          lt: oneYearAgo
        }
      }
    });
    
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      message: 'Database maintenance completed successfully',
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