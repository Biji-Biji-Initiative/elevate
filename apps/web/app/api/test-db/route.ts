import { NextResponse } from 'next/server';

import { prisma } from '@elevate/db/client';

export const runtime = 'nodejs';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  
  try {
    // Test the actual Prisma connection
    await prisma.$connect();
    const userCount = await prisma.user.count();
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      data: {
        hasDbUrl: !!dbUrl,
        dbUrlLength: dbUrl?.length || 0,
        dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
        nodeEnv: process.env.NODE_ENV,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE')),
        userCount
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        hasDbUrl: !!dbUrl,
        dbUrlLength: dbUrl?.length || 0,
        dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
        nodeEnv: process.env.NODE_ENV,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE'))
      }
    }, { status: 500 });
  }
}
