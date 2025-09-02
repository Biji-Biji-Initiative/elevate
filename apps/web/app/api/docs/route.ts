import { NextResponse } from 'next/server';
import { spec } from '@elevate/openapi';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}