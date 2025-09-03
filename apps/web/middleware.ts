import { type NextRequest } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'

import { locales, defaultLocale } from './i18n'

// Create the intl middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
})

const isPublicRoute = createRouteMatcher([
  '/',
  '/leaderboard',
  '/metrics/(.*)',
  '/u/(.*)', // Canonical public profile routes
  '/api/kajabi/webhook',
  '/api/health',
  // Include localized versions of public routes
  '/(en|id)/',
  '/(en|id)/leaderboard',
  '/(en|id)/metrics/(.*)',
  '/(en|id)/u/(.*)',
])

const isApiRoute = createRouteMatcher(['/api/(.*)'])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Bypass API routes; enforce auth at route level for JSON semantics
  if (isApiRoute(req)) return

  // Handle internationalization first
  const intlResponse = intlMiddleware(req)

  // If intl middleware returns a response (redirect), use it
  if (intlResponse) {
    return intlResponse
  }

  // Apply authentication for protected routes
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth()

    if (!userId) {
      return redirectToSignIn()
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)',
  ],
}
