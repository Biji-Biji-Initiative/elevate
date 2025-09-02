import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/queue(.*)',
  '/users(.*)',
  '/exports(.*)',
  '/api(.*)',
])

export default clerkMiddleware((auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // All other routes require authentication
  const { userId, sessionClaims } = auth()
  
  if (!userId) {
    return auth().redirectToSignIn()
  }

  // Check if user has minimum required role for admin access
  const userRole = (sessionClaims?.publicMetadata as any)?.role ?? 'participant'
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