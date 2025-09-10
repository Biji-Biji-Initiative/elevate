// This file configures the initialization of Sentry for edge features (middleware, edge API routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also applied to Node.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',

  // Higher sampling for admin app to catch issues
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  enabled: Boolean(process.env.SENTRY_DSN),

  // Node.js integrations (lean set to satisfy types)
  integrations: [Sentry.httpIntegration()],

  // Release tracking
  ...(process.env.VERCEL_GIT_COMMIT_SHA
    ? { release: process.env.VERCEL_GIT_COMMIT_SHA }
    : {}),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Error filtering and enhancement
  beforeSend(event) {
    // Add additional context for admin API errors
    if (event.request?.url) {
      event.tags = {
        ...event.tags,
        api_route: true,
        admin_operation: true,
      }
    }

    // Filter out expected errors in development
    // Filter out expected connection errors in development
    // (minimize type churn by not depending on hint types)
    // if (process.env.NODE_ENV === 'development' && (hint as { originalException?: { message?: string } } | undefined)?.originalException?.message?.includes('ECONNREFUSED')) return null

    return event
  },

  // Custom tags for admin server
  initialScope: {
    tags: {
      component: 'admin-server',
      runtime: process.env.NEXT_RUNTIME || 'nodejs',
    },
  },

  // Breadcrumb filtering
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null
    }

    // Enhance database breadcrumbs for admin operations
    if (breadcrumb.category === 'prisma') {
      breadcrumb.data = {
        ...breadcrumb.data,
        timestamp: new Date().toISOString(),
        admin_operation: true,
      }
    }

    return breadcrumb
  },
})

// Global error handlers
process.on('uncaughtException', (error) => {
  Sentry.captureException(error, {
    tags: {
      errorType: 'uncaughtException',
      component: 'admin-server',
    },
  })
})

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason, {
    tags: {
      errorType: 'unhandledRejection',
      component: 'admin-server',
    },
  })
})
