import { type NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'


export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  try {
    // Check database connection
    await prisma.$connect()

    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    )

    if (missingEnvVars.length > 0) {
      return createErrorResponse(new Error('Missing required environment variables'), 500)
    }

    return createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      environment: process.env.VERCEL_ENV || 'development',
      checks: {
        database: 'connected',
        environment: 'configured',
      },
    })
  } catch (error) {
    return createErrorResponse(
      new Error(error instanceof Error ? error.message : 'Unknown error'),
      503,
    )
  }
}

// Support HEAD requests for load balancers
export const HEAD = GET
