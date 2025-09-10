import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const qRaw = url.searchParams.get('q') || ''
    const q = qRaw.trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
    if (!q) return NextResponse.json({ data: [] }, { status: 200 })

    // Use case-insensitive search with ILIKE and limit
    const rows = await prisma.$queryRaw<{ name: string; city: string | null; province: string | null }[]>`
      SELECT name::text, city, province
      FROM schools
      WHERE name ILIKE ${'%' + q + '%'}
      ORDER BY name ASC
      LIMIT ${limit}
    `

    return NextResponse.json({ data: rows }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

