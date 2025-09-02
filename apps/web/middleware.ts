import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'id'],
  defaultLocale: 'id', // Indonesian as default
  localePrefix: 'as-needed'
});

const isPublicRoute = createRouteMatcher([
  '/',
  '/leaderboard',
  '/metrics/(.*)',
  '/u/(.*)',
  '/api/kajabi/webhook',
  '/api/health'
]);

const isApiRoute = createRouteMatcher(['/api/(.*)']);

export default clerkMiddleware((auth, req) => {
  // Skip authentication for API routes that don't need it
  if (isApiRoute(req) && req.nextUrl.pathname !== '/api/user' && !req.nextUrl.pathname.startsWith('/api/admin')) {
    return intlMiddleware(req);
  }

  // Apply authentication for protected routes
  if (!isPublicRoute(req)) {
    auth().protect();
  }

  // Apply internationalization
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};