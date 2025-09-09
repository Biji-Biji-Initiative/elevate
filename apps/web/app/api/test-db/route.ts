import { prisma } from '@elevate/db/client'
import { createSuccessResponse } from '@elevate/http'

export const runtime = 'nodejs'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL

  try {
    // Test the actual Prisma connection
    await prisma.$connect()
    const userCount = await prisma.user.count()
    await prisma.$disconnect()

    return createSuccessResponse({
      hasDbUrl: !!dbUrl,
      dbUrlLength: dbUrl?.length || 0,
      dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
      nodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(
        (k) => k.includes('DATABASE') || k.includes('SUPABASE'),
      ),
      userCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        dbUrlStart: dbUrl?.substring(0, 30) || 'undefined',
        nodeEnv: process.env.NODE_ENV,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
