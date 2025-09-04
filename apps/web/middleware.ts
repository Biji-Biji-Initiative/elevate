import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { csrfManager } from '@elevate/security/csrf'
import { createSecurityMiddleware, getSecurityConfig, withSecurity } from '@elevate/security/security-middleware'

// Routes that should be publicly accessible
const isPublicRoute = createRouteMatcher([
  '/',
  '/leaderboard',
  '/metrics/(.*)',
  '/u/(.*)', 
  '/api/health',
  '/api/docs',
  '/api/webhooks/(.*)',
  '/api/leaderboard',
  '/api/metrics',
  '/api/profile/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/csrf-token' // Public endpoint for CSRF token generation
])

// API routes that need CSRF protection (state-changing operations)
const isProtectedApiRoute = createRouteMatcher([
  '/api/submissions',
  '/api/files/upload',
  '/api/admin/(.*)'
])

// Main application middleware with security, CSRF, and authentication
const appMiddleware = clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  // Apply CSRF protection to protected API routes
  if (isProtectedApiRoute(req)) {
    const method = req.method.toUpperCase()
    
    // Only protect state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const isValid = await csrfManager.validateRequest(req)
      
      if (!isValid) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'CSRF token validation failed. Please refresh the page and try again.',
            code: 'CSRF_INVALID'
          },
          { status: 403 }
        )
      }
    }
  }

  // Protect non-public routes with authentication
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  return NextResponse.next()
})

// Configure security options based on environment
const securityConfig = getSecurityConfig()

// Add additional domains specific to the web app
const webSecurityConfig = {
  ...securityConfig,
  skipPaths: [
    '/api/health',
    '/api/webhooks/kajabi', // Skip CSP for webhook endpoints
    '/_next/static',
    '/favicon.ico'
  ],
  allowedDomains: {
    ...securityConfig.allowedDomains,
    external: [
      ...(securityConfig.allowedDomains?.external || []),
      // Add any web-specific external domains here
    ]
  },
  reportUri: '/api/csp-report'
}

// Export combined middleware with security headers and application logic
export default withSecurity(appMiddleware, webSecurityConfig)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}