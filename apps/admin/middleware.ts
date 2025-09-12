import { NextResponse } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { TRACE_HEADER, generateTraceId } from '@elevate/http'
import createIntlMiddleware from 'next-intl/middleware'

import {
  parseClerkPublicMetadata,
  safeParseRole,
  type RoleName,
} from '@elevate/auth'
// Security headers are applied via next.config.mjs headers()

import { locales, defaultLocale } from './i18n'

// Dev-only Supabase env guard (warn once at module init; non-fatal)
(() => {
  if (process.env.NODE_ENV === 'production') return
  const missingNew: string[] = []
  if (!process.env.SUPABASE_URL) missingNew.push('SUPABASE_URL')
  if (!process.env.SUPABASE_PUBLIC_KEY) missingNew.push('SUPABASE_PUBLIC_KEY')
  if (!process.env.SUPABASE_SECRET_KEY) missingNew.push('SUPABASE_SECRET_KEY')
  if (missingNew.length > 0) {
    console.warn(
      '[env] Supabase new variable names missing (using legacy if configured):',
      missingNew.join(', '),
    )
  }
})()

// Environment variable validation for runtime config
const requiredEnvVars = {
  // Clerk Auth (critical for admin)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  // Database (critical for admin operations)
  DATABASE_URL: process.env.DATABASE_URL,
  // Supabase (for file operations)
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
}

// Log missing env vars on startup (non-fatal in development/preview)
const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Missing required environment variables in admin app middleware:\n${missingEnvVars
      .map(v => `   - ${v}`)
      .join('\n')}\n   This may cause runtime failures.`
  )
  
  // In production, these missing vars will likely cause immediate failures
  if (process.env.NODE_ENV === 'production' && missingEnvVars.some(v => v.includes('CLERK'))) {
    console.error('❌ Critical: Clerk environment variables are missing. The admin app will fail to initialize.')
  }
  if (process.env.NODE_ENV === 'production' && missingEnvVars.includes('DATABASE_URL')) {
    console.error('❌ Critical: DATABASE_URL is missing. Admin operations will fail.')
  }
}

// Create the intl middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
})

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/unauthorized',
  // Include localized versions
  '/(en|id)/sign-in(.*)',
  '/(en|id)/sign-up(.*)',
  '/(en|id)/unauthorized',
])

// Main admin middleware with internationalization, authentication, and role checking
const adminMiddleware = clerkMiddleware(async (auth, req) => {
  const traceId = generateTraceId()
  const method = req.method
  const isGetLike = method === 'GET' || method === 'HEAD'
  const pathname = req.nextUrl.pathname
  const isApi = pathname.startsWith('/api/')
  // Establish Clerk context for all non-static requests to avoid downstream auth() detection errors
  await auth()

  // Ensure API routes also receive Clerk context for auth() usage
  // Downstream route handlers can still implement their own JSON auth checks
  // but we should not bypass middleware, otherwise auth() throws.

  // Allow public routes (intl only for GET/HEAD)
  if (isPublicRoute(req)) {
    // Never run i18n on API paths
    if (isApi) {
      const r = NextResponse.next()
      r.headers.set(TRACE_HEADER, traceId)
      return r
    }
    if (isGetLike) {
      const r = intlMiddleware(req)
      r.headers.set(TRACE_HEADER, traceId)
      return r
    }
    const r = NextResponse.next()
    r.headers.set(TRACE_HEADER, traceId)
    return r
  }

  // All other routes require authentication
  const { userId, sessionClaims, redirectToSignIn } = await auth()

  if (!userId) {
    if (isApi) {
      const r = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      r.headers.set(TRACE_HEADER, traceId)
      return r
    }
    if (isGetLike) return redirectToSignIn()
    const r = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    r.headers.set(TRACE_HEADER, traceId)
    return r
  }

  // Check if user has minimum required role for admin access
  const publicMetadata = parseClerkPublicMetadata(sessionClaims?.publicMetadata)
  let userRole = safeParseRole(publicMetadata.role)
  
  // Development bypass for specific user IDs (opt-in via env)
  // Use CSV in ADMIN_DEV_BYPASS_USER_IDS, only in development
  if (process.env.NODE_ENV === 'development') {
    const csv = (process.env.ADMIN_DEV_BYPASS_USER_IDS || '').trim()
    if (csv.length > 0) {
      const allow = new Set(csv.split(',').map((s) => s.trim()).filter(Boolean))
      if (allow.has(userId)) {
        userRole = 'superadmin'
      }
    }
  }
  
  const allowedRoles: RoleName[] = ['reviewer', 'admin', 'superadmin']
  
  // Auth check passed for route

  if (!allowedRoles.includes(userRole)) {
    if (isApi) {
      const r = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      r.headers.set(TRACE_HEADER, traceId)
      return r
    }
    if (isGetLike) return NextResponse.redirect(new URL('/unauthorized', req.url))
    const r = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    r.headers.set(TRACE_HEADER, traceId)
    return r
  }

  // After authz, apply intl locale handling only for GET/HEAD. Other methods
  // must pass through untouched so Next.js can handle RSC/server actions.
  if (isApi) {
    const r = NextResponse.next()
    r.headers.set(TRACE_HEADER, traceId)
    return r
  }
  if (isGetLike) {
    const r = intlMiddleware(req)
    r.headers.set(TRACE_HEADER, traceId)
    return r
  }
  const r = NextResponse.next()
  r.headers.set(TRACE_HEADER, traceId)
  return r
})

// Security configuration handled centrally; no per-middleware overrides here.

// Export Clerk+i18n admin middleware directly. Security headers are provided
// by next.config.mjs headers() to avoid interfering with Clerk detection.
export default adminMiddleware

export const config = {
  // Use Clerk's recommended matcher to ensure API routes are always matched
  matcher: ['/((?!.*\\..*|_next).*)', '/(api|trpc)(.*)'],
}
