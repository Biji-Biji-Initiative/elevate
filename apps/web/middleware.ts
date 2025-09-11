import { NextResponse, type NextRequest } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { parseClerkPublicMetadata } from '@elevate/auth'
import createIntlMiddleware from 'next-intl/middleware'

import { locales, defaultLocale } from './i18n'

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
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.includes('/static/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
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
        if (!cookies.get('ref')) {
          res.cookies.set('ref', ref, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 })
        }
        return res
      }
      // Otherwise, just set cookie and continue
      const res = NextResponse.next()
      if (!cookies.get('ref')) {
        res.cookies.set('ref', ref, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 })
      }
      if (pathname.startsWith('/api/')) return res
      const intlResponse = intlMiddleware(request)
      if (isPublicRoute(request)) return intlResponse
    }
  } catch (err) {
    // Ignore referral cookie errors
    console.warn('Referral cookie handling failed', err)
  }

  // Handle API routes without i18n; allow handlers to enforce auth explicitly
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Handle i18n for page routes
  const intlResponse = intlMiddleware(request)

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
        return NextResponse.redirect(new URL(`/${locale}/educators-only`, request.url))
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
          return NextResponse.redirect(new URL(`/${locale}/educators-only`, request.url))
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
