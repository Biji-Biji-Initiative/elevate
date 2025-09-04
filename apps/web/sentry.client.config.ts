// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Capture unhandled promise rejections
  captureUnhandledRejections: true,
  
  // Performance monitoring
  enableTracing: true,
  
  // Session tracking for release health
  autoSessionTracking: true,
  
  // Capture interaction events
  integrations: [
    Sentry.browserTracingIntegration({
      // Set sample rates for performance monitoring
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/leaps\.mereka\.org/,
        /^https:\/\/.*\.vercel\.app/,
      ],
    }),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      // Only capture replays for errors in production
      sessionSampleRate: process.env.NODE_ENV === 'production' ? 0 : 0.1,
      errorSampleRate: 1.0,
    }),
  ],

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Error filtering
  beforeSend(event, hint) {
    // Filter out development and localhost errors in production
    if (process.env.NODE_ENV === 'production') {
      if (event.request?.url?.includes('localhost')) {
        return null
      }
    }

    // Filter out known non-critical errors
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null
    }

    // Add user context from Clerk if available
    if (typeof window !== 'undefined' && window.Clerk?.user) {
      const user = window.Clerk.user
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username,
      })
    }

    return event
  },

  // Custom tags
  initialScope: {
    tags: {
      component: 'web-app',
    },
  },
})

// Global error handler for React errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    Sentry.captureException(event.error, {
      contexts: {
        react: {
          componentStack: event.error?.componentStack,
        },
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
      tags: {
        errorType: 'unhandledPromiseRejection',
      },
    })
  })
}