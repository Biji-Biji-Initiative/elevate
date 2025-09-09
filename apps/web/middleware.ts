import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { locales, defaultLocale } from './i18n'

// Create the i18n middleware with proper configuration
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // Only add locale prefix when not using default locale
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
  '/api/public/(.*)',
  '/api/stories(.*)',
  '/api/leaderboard(.*)',
  '/api/stats(.*)',
  '/api/kajabi/webhook',
  '/api/profile/(.*)', // Public profile API
  '/api/test-db',
])

// Create the Clerk middleware with i18n integration
export default clerkMiddleware((auth, request: NextRequest) => {
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
    // Check if route requires authentication
    if (!isPublicRoute(request)) {
      // Verify authentication for protected API routes
      const { userId } = auth()
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  // Handle i18n for page routes
  const intlResponse = intlMiddleware(request)

  // Check authentication for protected routes
  // The intlMiddleware already handles locale routing, so we check the original request
  if (!isPublicRoute(request)) {
    // This route requires authentication
    const { userId } = auth()
    if (!userId) {
      // Redirect to sign-in page with the current locale
      const locale = request.nextUrl.pathname.split('/')[1]
      const validLocale = locales.includes(locale) ? locale : defaultLocale
      const signInUrl = new URL(`/${validLocale}/sign-in`, request.url)
      signInUrl.searchParams.set('redirect_url', request.url)
      return NextResponse.redirect(signInUrl)
    }
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
