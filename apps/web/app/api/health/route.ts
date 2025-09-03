import { NextResponse } from 'next/server';

import { prisma } from '@elevate/db/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Log DATABASE_URL for debugging (only first and last 20 chars for security)
    const dbUrl = process.env.DATABASE_URL;
    const urlLog = dbUrl ? `${dbUrl.substring(0, 20)}...${dbUrl.substring(dbUrl.length - 20)}` : 'undefined';
    
    // Check database connection
    await prisma.$connect();
    
    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    );
    
    if (missingEnvVars.length > 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing required environment variables',
        details: { missingEnvVars }
      }, { status: 500 });
    }
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      environment: process.env.VERCEL_ENV || 'development',
      checks: {
        database: 'connected',
        environment: 'configured'
      }
    });
    
  } catch (error) {
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

// Support HEAD requests for load balancers
export const HEAD = GET;