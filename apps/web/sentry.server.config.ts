// This file configures the initialization of Sentry for edge features (middleware, edge API routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also applied to Node.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

{
  const dsn = process.env.SENTRY_DSN
  const release = process.env.VERCEL_GIT_COMMIT_SHA
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV

  const options: Sentry.NodeOptions = {
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: process.env.NODE_ENV === 'development',

    enabled: Boolean(dsn),

    // Performance profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Node.js specific integrations
    integrations: [Sentry.httpIntegration(), Sentry.prismaIntegration()],

    environment,

    // Error filtering and enhancement
    beforeSend(event, hint) {
      // Add additional context for API errors
      if (event.request?.url) {
        event.tags = {
          ...event.tags,
          api_route: true,
        }
      }

      // Filter out expected errors in development
      if (process.env.NODE_ENV === 'development') {
        const originalException = hint?.originalException
        const message =
          originalException &&
          typeof (originalException as { message?: unknown }).message ===
            'string'
            ? (originalException as { message: string }).message
            : undefined
        if (message && message.includes('ECONNREFUSED')) return null
      }

      return event
    },

    // Custom tags for server-side tracking
    initialScope: {
      tags: {
        component: 'web-server',
        runtime: process.env.NEXT_RUNTIME || 'nodejs',
      },
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null
      }

      // Enhance database breadcrumbs
      if (breadcrumb.category === 'prisma') {
        breadcrumb.data = {
          ...breadcrumb.data,
          timestamp: new Date().toISOString(),
        }
      }

      return breadcrumb
    },
  }

  if (dsn) options.dsn = dsn
  if (release) options.release = release

  Sentry.init(options)
}

// Global error handlers
process.on('uncaughtException', (error) => {
  Sentry.captureException(error, {
    tags: {
      errorType: 'uncaughtException',
    },
  })
})

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  Sentry.captureException(err, {
    tags: {
      errorType: 'unhandledRejection',
    },
  })
})
