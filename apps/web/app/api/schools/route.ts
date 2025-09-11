import type { NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const qRaw = url.searchParams.get('q') || ''
    const q = qRaw.trim()
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
    if (!q) return createSuccessResponse({ data: [] })

    const rows = await prisma.$queryRaw<{ name: string; city: string | null; province: string | null }[]>`
      SELECT name::text, city, province
      FROM schools
      WHERE name ILIKE ${'%' + q + '%'}
      ORDER BY name ASC
      LIMIT ${limit}
    `

    return createSuccessResponse({ data: rows })
  } catch (e) {
    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
