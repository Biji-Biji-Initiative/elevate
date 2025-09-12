import { type NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'


export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  try {
    // Check database connection
    await prisma.$connect()

    // Resolve Supabase using new naming only
    const supabaseUrl = process.env.SUPABASE_URL
    const supabasePublicKey = process.env.SUPABASE_PUBLIC_KEY
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

    // Check required environment variables (minimal set for runtime)
    const required = {
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_PUBLIC_KEY: supabasePublicKey,
      SUPABASE_SECRET_KEY: supabaseSecretKey,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    }

    const missing = Object.entries(required)
      .filter(([_, v]) => !v)
      .map(([k]) => k)

    if (missing.length > 0) {
      return createErrorResponse(
        new Error(
          `Missing required environment variables: ${missing.join(', ')}`,
        ),
        500,
      )
    }

    // Helper maskers
    const mask = (value: string, start = 4, end = 4) => {
      if (!value) return ''
      if (value.length <= start + end) return '*'.repeat(value.length)
      return `${value.slice(0, start)}…${value.slice(-end)}`
    }

    const redactUrl = (dbUrl?: string) => {
      if (!dbUrl) return undefined
      try {
        const u = new URL(dbUrl)
        return { host: u.hostname, port: u.port || undefined, db: u.pathname.replace(/^\//, '') }
      } catch {
        return undefined
      }
    }

    const now = new Date().toISOString()
    const version = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'
    const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'

    return createSuccessResponse({
      status: 'healthy',
      timestamp: now,
      version,
      environment,
      checks: {
        database: 'connected',
        environment: 'configured',
      },
      config: {
        database: redactUrl(process.env.DATABASE_URL),
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        clerk: {
          publishableKey: mask(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!),
          secretKey: mask(process.env.CLERK_SECRET_KEY!),
        },
        supabase: {
          url: supabaseUrl,
          publicKey: mask(supabasePublicKey!),
          secretKey: mask(supabaseSecretKey!),
          usingLegacyNames: false,
        },
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
