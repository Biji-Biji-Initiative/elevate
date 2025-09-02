import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/leaderboard',
  '/metrics/(.*)',
  '/u/(.*)', // Canonical public profile routes
  '/api/kajabi/webhook',
  '/api/health'
]);

const isApiRoute = createRouteMatcher(['/api/(.*)']);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Skip all middleware processing for API routes except protected ones
  if (isApiRoute(req)) {
    // Only apply auth to protected API routes
    if (req.nextUrl.pathname.startsWith('/api/admin') || req.nextUrl.pathname === '/api/user') {
      const { userId, redirectToSignIn } = await auth();
      if (!userId) {
        return redirectToSignIn();
      }
    }
    return; // Skip further processing for API routes
  }

  // Handle locale prefix redirects - remove them for now to fix routing
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/en/') || pathname.startsWith('/id/')) {
    const newPathname = pathname.replace(/^\/(en|id)/, '') || '/';
    const url = req.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.redirect(url);
  }

  // Apply authentication for protected routes
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    
    if (!userId) {
      return redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};