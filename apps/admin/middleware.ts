import { NextResponse } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware';

import { parseClerkPublicMetadata, safeParseRole, type RoleName } from '@elevate/auth';
import { getSecurityConfig, withSecurity } from '@elevate/security/security-middleware'

import { locales, defaultLocale } from './i18n';


// Create the intl middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

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
  // Bypass API routes; route handlers enforce JSON auth semantics
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  // Handle internationalization first for non-API routes
  const intlResponse = intlMiddleware(req);
  
  // If intl middleware returns a response (redirect), use it
  if (intlResponse) {
    return intlResponse;
  }

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // All other routes require authentication
  const { userId, sessionClaims, redirectToSignIn } = await auth()
  
  if (!userId) {
    return redirectToSignIn()
  }

  // Check if user has minimum required role for admin access
  const publicMetadata = parseClerkPublicMetadata(sessionClaims?.publicMetadata)
  const userRole = safeParseRole(publicMetadata.role)
  const allowedRoles: RoleName[] = ['reviewer', 'admin', 'superadmin']
  
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

// Configure security options based on environment for admin app
const securityConfig = getSecurityConfig()

// Add additional domains specific to the admin app
const adminSecurityConfig = {
  ...securityConfig,
  skipPaths: [
    '/api/health',
    '/_next/static',
    '/favicon.ico'
  ],
  allowedDomains: {
    ...securityConfig.allowedDomains,
    external: [
      ...(securityConfig.allowedDomains?.external || []),
      // Add any admin-specific external domains here
    ]
  },
  reportUri: '/api/csp-report'
}

// Export combined middleware with security headers and admin logic
export default withSecurity(adminMiddleware, adminSecurityConfig)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
