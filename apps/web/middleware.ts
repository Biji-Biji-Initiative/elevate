import { NextResponse, type NextRequest } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { TRACE_HEADER, generateTraceId } from '@elevate/http'
import { parseClerkPublicMetadata } from '@elevate/auth'
import createIntlMiddleware from 'next-intl/middleware'

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
  // Clerk Auth
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  // App URLs
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
}

// Log missing env vars on startup (non-fatal in development/preview)
const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Missing required environment variables in web app middleware:\n${missingEnvVars
      .map(v => `   - ${v}`)
      .join('\n')}\n   This may cause runtime failures.`
  )
  
  // In production, these missing vars will likely cause immediate failures
  if (process.env.NODE_ENV === 'production' && missingEnvVars.some(v => v.includes('CLERK'))) {
    console.error('❌ Critical: Clerk environment variables are missing. The app will fail to initialize.')
  }
}

// Create the i18n middleware with proper configuration
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/(en|id)',
  '/(en|id)/',
  '/(en|id)/sign-in(.*)',
  '/(en|id)/sign-up(.*)',
  '/(en|id)/u/(.*)', // Public profiles
  '/(en|id)/leaderboard(.*)',
  '/(en|id)/metrics/(.*)',
  // Accept unlocalized variants to be resilient to stray links
  '/u/(.*)',
  '/leaderboard(.*)',
  '/metrics/(.*)',
  // Public APIs
  '/api/public/(.*)',
  '/api/stories(.*)',
  '/api/leaderboard(.*)',
  '/api/stats(.*)',
  '/api/metrics(.*)',
  '/api/kajabi/webhook',
  '/api/profile/(.*)', // Public profile API
  '/api/test-db',
])

// Educator-only page routes (localized and non-localized fallbacks)
const isEducatorOnlyRoute = createRouteMatcher([
  '/(en|id)/dashboard(.*)',
  '/dashboard(.*)',
])

// Metrics routes are public but we still redirect signed-in Students to educators-only
const isMetricsRoute = createRouteMatcher([
  '/(en|id)/metrics/(.*)',
  '/metrics/(.*)',
])

// Create the Clerk middleware with i18n integration
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const traceId = generateTraceId()
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.includes('/static/') ||
    pathname.includes('.')
  ) {
    const res = NextResponse.next()
    res.headers.set(TRACE_HEADER, traceId)
    return res
  }

  // Call auth() for all non-static requests to ensure Clerk context is established
  // This prevents "auth() was called but Clerk can't detect usage of clerkMiddleware()" in downstream handlers
  await auth()

  // Handle referral capture early for any route (including public pages)
  try {
    const url = new URL(request.url)
    const ref = url.searchParams.get('ref')
    if (ref && ref.length <= 64) {
      const cookies = request.cookies
      const { userId } = await auth()
      // If unauthenticated and not already on sign-in/up, redirect to localized sign-up
      const isAuthPage = /\/sign-in|\/sign-up/.test(pathname)
      if (!userId && !isAuthPage) {
        const localeMatch = pathname.match(/^\/(en|id)(\/|$)/)
        const locale = localeMatch ? localeMatch[1] : defaultLocale
        const redirectUrl = new URL(`/${locale}/sign-up`, url)
        const res = NextResponse.redirect(redirectUrl)
        res.headers.set(TRACE_HEADER, traceId)
        if (!cookies.get('ref')) {
          res.cookies.set('ref', ref, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 })
        }
        return res
      }
      // Otherwise, just set cookie and continue
      const res = NextResponse.next()
      res.headers.set(TRACE_HEADER, traceId)
      if (!cookies.get('ref')) {
        res.cookies.set('ref', ref, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 })
      }
      if (pathname.startsWith('/api/')) return res
      const intlResponse = intlMiddleware(request)
      intlResponse.headers.set(TRACE_HEADER, traceId)
      if (isPublicRoute(request)) return intlResponse
    }
  } catch (err) {
    // Ignore referral cookie errors
    console.warn('Referral cookie handling failed', err)
  }

  // Handle API routes without i18n; allow handlers to enforce auth explicitly
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    res.headers.set(TRACE_HEADER, traceId)
    return res
  }

  // Handle i18n for page routes
  const intlResponse = intlMiddleware(request)
  intlResponse.headers.set(TRACE_HEADER, traceId)

  // Check authentication for protected page routes
  if (!isPublicRoute(request)) {
    const { userId, redirectToSignIn } = await auth()
    if (!userId) return redirectToSignIn()

    // Server-side student gating for educator-only routes to avoid client flashes
    if (isEducatorOnlyRoute(request)) {
      const { sessionClaims } = await auth()
      const meta = parseClerkPublicMetadata(
        (sessionClaims as Record<string, unknown> | undefined)?.publicMetadata,
      )
      const userType = (meta.user_type || '').toUpperCase()
      if (userType === 'STUDENT') {
        const localeMatch = pathname.match(/^\/(en|id)(\/|$)/)
        const locale = localeMatch ? localeMatch[1] : defaultLocale
        const res = NextResponse.redirect(new URL(`/${locale}/educators-only`, request.url))
        res.headers.set(TRACE_HEADER, traceId)
        return res
      }
    }
  }

  // For public metrics pages, if the user is signed-in as STUDENT, redirect to educators-only
  try {
    if (isMetricsRoute(request)) {
      const { userId, sessionClaims } = await auth()
      if (userId) {
        const meta = parseClerkPublicMetadata(
          (sessionClaims as Record<string, unknown> | undefined)?.publicMetadata,
        )
        const userType = (meta.user_type || '').toUpperCase()
        if (userType === 'STUDENT') {
          const localeMatch = pathname.match(/^\/(en|id)(\/|$)/)
          const locale = localeMatch ? localeMatch[1] : defaultLocale
          const res = NextResponse.redirect(new URL(`/${locale}/educators-only`, request.url))
          res.headers.set(TRACE_HEADER, traceId)
          return res
        }
      }
    }
  } catch {
    // ignore session parse errors
  }

  return intlResponse
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
