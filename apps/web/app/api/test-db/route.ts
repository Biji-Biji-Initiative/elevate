import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  
  // Return just the env var info
  return NextResponse.json({
    hasDbUrl: !!dbUrl,
    dbUrlLength: dbUrl?.length || 0,
    dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE'))
  });
}