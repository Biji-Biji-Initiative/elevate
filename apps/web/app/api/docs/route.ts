import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function GET(request: NextRequest) {
  const url = new URL('/openapi.json', request.url)
  return NextResponse.redirect(url)
}

