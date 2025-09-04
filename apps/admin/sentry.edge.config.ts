// This file configures the initialization of Sentry for edge features (middleware, edge API routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also applied to Node.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  enabled: Boolean(process.env.SENTRY_DSN),

  // Edge runtime has limited integrations
  integrations: [],

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Custom tags for admin edge runtime
  initialScope: {
    tags: {
      component: 'admin-edge',
      runtime: 'edge',
    },
  },

  // Minimal error filtering for edge runtime
  beforeSend(event) {
    // Add edge-specific context for admin
    event.tags = {
      ...event.tags,
      edge_runtime: true,
      admin_operation: true,
    }

    return event
  },
})