import { NextResponse } from 'next/server';

import { prisma } from '@elevate/db/client';
import { createSuccessResponse, createErrorResponse } from '@elevate/types'


export const runtime = 'nodejs';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  
  try {
    // Test the actual Prisma connection
    await prisma.$connect();
    const userCount = await prisma.user.count();
    await prisma.$disconnect();
    
    return createSuccessResponse({
      hasDbUrl: !!dbUrl,
      dbUrlLength: dbUrl?.length || 0,
      dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
      nodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE')),
      userCount
    });
  } catch (error) {
    return createErrorResponse(new Error(error instanceof Error ? error.message : 'Unknown error'), 500)
  }
}
