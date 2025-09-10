import { NextResponse } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'

import {
  parseClerkPublicMetadata,
  safeParseRole,
  type RoleName,
} from '@elevate/auth'
import { parseClerkEmailAddress } from '@elevate/auth/types'
// Security headers are applied via next.config.mjs headers()

import { locales, defaultLocale } from './i18n'

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
    return isApi
      ? NextResponse.next()
      : isGetLike
      ? intlMiddleware(req)
      : NextResponse.next()
  }

  // All other routes require authentication
  const { userId, sessionClaims, redirectToSignIn } = await auth()

  if (!userId) {
    if (isApi)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return isGetLike
      ? redirectToSignIn()
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has minimum required role for admin access
  const publicMetadata = parseClerkPublicMetadata(sessionClaims?.publicMetadata)
  let userRole = safeParseRole(publicMetadata.role)
  const email = parseClerkEmailAddress(sessionClaims?.primaryEmailAddress)
  if (process.env.NODE_ENV === 'development' && email) {
    const csv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').toLowerCase()
    if (csv.length > 0) {
      const allow = new Set(
        csv
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      )
      if (allow.has(email.toLowerCase())) userRole = 'superadmin'
    }
  }
  const allowedRoles: RoleName[] = ['reviewer', 'admin', 'superadmin']

  if (!allowedRoles.includes(userRole)) {
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return isGetLike
      ? NextResponse.redirect(new URL('/unauthorized', req.url))
      : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // After authz, apply intl locale handling only for GET/HEAD. Other methods
  // must pass through untouched so Next.js can handle RSC/server actions.
  if (isApi) return NextResponse.next()
  return isGetLike ? intlMiddleware(req) : NextResponse.next()
})

// Security configuration handled centrally; no per-middleware overrides here.

// Export Clerk+i18n admin middleware directly. Security headers are provided
// by next.config.mjs headers() to avoid interfering with Clerk detection.
export default adminMiddleware

export const config = {
  // Use Clerk's recommended matcher to ensure API routes are always matched
  matcher: ['/((?!.*\\..*|_next).*)', '/(api|trpc)(.*)'],
}
