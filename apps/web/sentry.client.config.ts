// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { getClerkUserFromWindow } from '@elevate/auth/window-clerk'

{
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  const release = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  const environment = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV

  const options: Sentry.BrowserOptions = {
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: process.env.NODE_ENV === 'development',

    enabled: Boolean(dsn),

    // Capture interaction events
    integrations: [
      Sentry.browserTracingIntegration({}),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    environment,

    // Error filtering
    beforeSend(event) {
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
      const user = getClerkUserFromWindow()
      if (user) {
        Sentry.setUser({ id: user.id })
      }

      return event
    },

    // Custom tags
    initialScope: {
      tags: {
        component: 'web-app',
      },
    },
  }

  if (dsn) options.dsn = dsn
  if (release) options.release = release

  // Replay sample rates
  options.replaysSessionSampleRate =
    process.env.NODE_ENV === 'production' ? 0 : 0.1
  options.replaysOnErrorSampleRate = 1.0

  Sentry.init(options)
}

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
