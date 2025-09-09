import { NextResponse, type NextRequest } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
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

  // Handle API routes without i18n
  if (pathname.startsWith('/api/')) {
    // Let API handlers enforce auth if needed
    return NextResponse.next()
  }

  // Handle i18n for page routes
  const intlResponse = intlMiddleware(request)

  // Check authentication for protected routes
  if (!isPublicRoute(request)) {
    const { userId, redirectToSignIn } = await auth()
    if (!userId) return redirectToSignIn()
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
