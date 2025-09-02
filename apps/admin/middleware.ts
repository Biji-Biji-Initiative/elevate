import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server'
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


export default clerkMiddleware(async (auth, req) => {
  // Skip API routes from i18n processing
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Allow public routes
    if (isPublicRoute(req)) {
      return NextResponse.next()
    }

    // All other API routes require authentication
    const { userId, sessionClaims, redirectToSignIn } = await auth()
    
    if (!userId) {
      return redirectToSignIn()
    }

    // Check if user has minimum required role for admin access
    const userRole = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string ?? 'participant'
    const allowedRoles = ['reviewer', 'admin', 'superadmin']
    
    if (!allowedRoles.includes(userRole.toLowerCase())) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  }

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
  const userRole = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role as string ?? 'participant'
  const allowedRoles = ['reviewer', 'admin', 'superadmin']
  
  if (!allowedRoles.includes(userRole.toLowerCase())) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}