/**
 * Content Security Policy (CSP) utilities for the MS Elevate LEAPS Tracker
 *
 * This module provides comprehensive CSP generation and management for secure
 * operation with Clerk authentication, Supabase storage, and Next.js requirements.
 */

// Use Web Crypto API for edge runtime compatibility

import type { NextRequest } from 'next/server'

export interface CSPOptions {
  nonce?: string
  isDevelopment?: boolean
  reportOnly?: boolean
  reportUri?: string
  /** Add a `report-to` directive and matching Report-To header when reporting */
  addReportTo?: boolean
  applyToApiRoutes?: boolean
  allowedDomains?: {
    clerk?: string[]
    supabase?: string[]
    fonts?: string[]
    images?: string[]
    analytics?: string[]
    external?: string[]
  }
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string
  'Content-Security-Policy-Report-Only'?: string
  'X-Frame-Options': string
  'X-Content-Type-Options': string
  'Referrer-Policy': string
  'Permissions-Policy': string
  'Strict-Transport-Security'?: string
  'X-XSS-Protection': string
  'X-DNS-Prefetch-Control': string
  'X-Permitted-Cross-Domain-Policies'?: string
  'Cross-Origin-Embedder-Policy'?: string
  'Cross-Origin-Opener-Policy'?: string
  'Cross-Origin-Resource-Policy'?: string
}

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API for edge runtime compatibility
 */
export function generateNonce(): string {
  // Prefer Node crypto for tests that stub randomBytes; fallback to Web Crypto
  try {
    // @ts-expect-error - node:crypto may not be available in edge
    const nodeCrypto: typeof import('node:crypto') | undefined = (globalThis as any).require
      ? (globalThis as any).require('node:crypto')
      : undefined
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      return nodeCrypto.randomBytes(16).toString('base64')
    }
  } catch {
    // ignore and fallback
  }
  const array = new Uint8Array(16)
  // Web Crypto API
  // @ts-expect-error - web crypto exists in modern runtimes
  (globalThis.crypto as Crypto).getRandomValues(array)
  // Convert to base64
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(array).toString('base64')
  }
  return btoa(String.fromCharCode(...array))
}

/**
 * Build Content Security Policy directives
 */
export function buildCSPDirectives(options: CSPOptions = {}): string {
  const {
    nonce,
    isDevelopment = process.env.NODE_ENV === 'development',
    reportOnly = false,
    allowedDomains = {},
  } = options

  // Base domains for different services
  const clerkDomains = [
    'https://clerk.dev',
    'https://*.clerk.dev',
    'https://images.clerk.dev',
    'https://img.clerk.com',
    'https://api.clerk.dev',
    'https://*.clerk.com',
    'https://*.clerk.accounts.dev',
    ...(allowedDomains.clerk || []),
  ]

  const supabaseDomains = [
    'https://*.supabase.co',
    'https://*.supabase.in',
    ...(allowedDomains.supabase || []),
  ]

  const fontDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    ...(allowedDomains.fonts || []),
  ]

  const imageDomains = [
    'data:',
    'https://res.cloudinary.com',
    ...clerkDomains,
    ...supabaseDomains,
    ...(allowedDomains.images || []),
  ]

  const analyticsDomains = [
    'https://vitals.vercel-analytics.com',
    'https://vercel-insights.com',
    'https://*.sentry.io',
    ...(allowedDomains.analytics || []),
  ]

  const externalDomains = allowedDomains.external || []

  // Build CSP directives
  const directives: Record<string, string[]> = {
    // Default source - restrict to self and essential domains
    'default-src': ["'self'"],

    // Script sources - includes Next.js requirements and nonce
    'script-src': [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      "'unsafe-eval'", // Required for Next.js development
      "'unsafe-inline'", // Required for some Next.js inline scripts
      'https://vercel.live',
      ...clerkDomains,
      ...analyticsDomains,
      ...(isDevelopment ? ["'unsafe-eval'", 'webpack:'] : []),
    ],

    // Style sources - includes inline styles and font providers
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for CSS-in-JS libraries like styled-components
      ...fontDomains,
      ...clerkDomains,
    ],

    // Image sources - comprehensive list for all image providers
    'img-src': ["'self'", 'blob:', 'data:', ...imageDomains],

    // Font sources - web fonts and icon fonts
    'font-src': ["'self'", 'data:', ...fontDomains],

    // Connect sources - APIs and WebSockets
    'connect-src': [
      "'self'",
      ...clerkDomains,
      ...supabaseDomains,
      ...analyticsDomains,
      'https://vitals.vercel-analytics.com',
      'wss://*.supabase.co', // Supabase realtime
      ...(isDevelopment ? ['http://localhost:*', 'ws://localhost:*'] : []),
      ...externalDomains,
    ],

    // Media sources - for audio/video content
    'media-src': ["'self'", 'blob:', 'data:', ...supabaseDomains],

    // Object sources - plugins and embeds (restricted)
    'object-src': ["'none'"],

    // Frame sources - iframes (restricted to essential services)
    'frame-src': [
      "'self'",
      ...clerkDomains,
      'https://vercel.live', // Vercel preview comments
    ],

    // Child sources - web workers and frames
    'child-src': ["'self'", 'blob:'],

    // Worker sources - service workers and web workers
    'worker-src': ["'self'", 'blob:'],

    // Manifest sources - web app manifest
    'manifest-src': ["'self'"],

    // Base URI - restrict base tag
    'base-uri': ["'self'"],

    // Form action - restrict form submissions
    'form-action': ["'self'", ...clerkDomains, ...supabaseDomains],

    // Frame ancestors - prevent clickjacking. In report-only mode this has no
    // effect and causes noisy warnings, so omit it when reportOnly=true.
    ...(!reportOnly ? { 'frame-ancestors': ["'none'"] } : {}),

    // Upgrade insecure requests in production
    ...(isDevelopment ? {} : { 'upgrade-insecure-requests': [] }),
  }

  // Convert directives object to CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => {
      const sourceList = sources.length > 0 ? ` ${sources.join(' ')}` : ''
      return `${directive}${sourceList}`
    })
    .join('; ')
}

/**
 * Generate all security headers
 */
export function generateSecurityHeaders(
  options: CSPOptions = {},
): SecurityHeaders {
  const {
    reportOnly = false,
    reportUri,
    isDevelopment = process.env.NODE_ENV === 'development',
    addReportTo = true,
  } = options

  const reportGroup = 'csp-endpoint'
  const hasReportTo = Boolean(reportOnly && reportUri && addReportTo)

  const cspValue =
    buildCSPDirectives(options) +
    (reportUri ? `; report-uri ${reportUri}` : '') +
    (hasReportTo ? `; report-to ${reportGroup}` : '')

  const headers: SecurityHeaders = {
    // CSP header (either enforcing or report-only)
    ...(reportOnly
      ? { 'Content-Security-Policy-Report-Only': cspValue }
      : { 'Content-Security-Policy': cspValue }),

    // Prevent framing attacks
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Restrict powerful web platform features - comprehensive list
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'payment=()',
      'sync-xhr=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'bluetooth=()',
      'midi=()',
      'notifications=()',
      'push=()',
      'speaker-selection=()',
      'ambient-light-sensor=()',
      'battery=()',
      'display-capture=()',
      'document-domain=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'gamepad=()',
      'hid=()',
      'idle-detection=()',
      'local-fonts=()',
      'serial=()',
      'storage-access=()',
      'window-management=()',
      'xr-spatial-tracking=()',
    ].join(', '),

    // Legacy XSS protection (still useful for older browsers)
    'X-XSS-Protection': '1; mode=block',

    // Control DNS prefetching
    'X-DNS-Prefetch-Control': 'on',
  }

  // Add HSTS in production with longer max-age and security optimizations
  if (!isDevelopment) {
    headers['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains; preload'
  }

  // Additional modern security headers
  headers['X-Permitted-Cross-Domain-Policies'] = 'none'
  headers['Cross-Origin-Embedder-Policy'] = 'credentialless'
  headers['Cross-Origin-Opener-Policy'] = 'same-origin'
  headers['Cross-Origin-Resource-Policy'] = 'same-origin'

  // Reporting endpoint header (legacy). Modern browsers prefer
  // `Reporting-Endpoints`, but `Report-To` removes the dev console warning.
  if (hasReportTo && reportUri) {
    const reportToValue = JSON.stringify({
      group: reportGroup,
      max_age: 10886400,
      endpoints: [{ url: reportUri }],
      include_subdomains: true,
    })
    ;(headers as unknown as Record<string, string>)['Report-To'] = reportToValue
  }

  return headers
}

/**
 * Apply security headers to a Response object
 */
export function applySecurityHeaders(
  response: Response,
  options: CSPOptions = {},
): Response {
  const headers = generateSecurityHeaders(options)

  Object.entries(headers).forEach(([name, value]) => {
    if (value) {
      response.headers.set(name, String(value))
    }
  })

  return response
}

/**
 * Create CSP middleware for Next.js
 */
export function createCSPMiddleware(options: Omit<CSPOptions, 'nonce'> = {}) {
  return function cspMiddleware(
    request: NextRequest,
    response: Response,
  ): Response {
    // Skip CSP headers for API routes unless specifically requested
    const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
    if (isApiRoute && !options.applyToApiRoutes) {
      return response
    }

    // Generate a unique nonce for each request
    const nonce = generateNonce()

    // Store nonce in response headers for downstream usage
    response.headers.set('x-csp-nonce', nonce)

    // Apply security headers with nonce
    const securedResponse = applySecurityHeaders(response, {
      ...options,
      nonce,
    })

    return securedResponse
  }
}

/**
 * Extract nonce from request headers (for use in React components)
 */
export function getNonceFromRequest(
  request: NextRequest | Request,
): string | undefined {
  return request.headers.get('x-csp-nonce') || undefined
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(options: CSPOptions): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check for common misconfigurations
  if (options.allowedDomains?.external) {
    const external = options.allowedDomains.external
    for (const domain of external) {
      // Allow WebSocket protocols
      if (
        !domain.startsWith('https://') &&
        !domain.startsWith('http://') &&
        !domain.startsWith('ws://') &&
        !domain.startsWith('wss://')
      ) {
        errors.push(
          `External domain "${domain}" should include protocol (https://, http://, ws://, or wss://)`,
        )
      }
      if (
        domain.includes('*') &&
        !domain.startsWith('https://*.') &&
        !domain.startsWith('http://*.') &&
        !domain.startsWith('ws://*.') &&
        !domain.startsWith('wss://*.')
      ) {
        errors.push(
          `Wildcard domain "${domain}" should be properly formatted (e.g., https://*.example.com)`,
        )
      }
    }
  }

  // Validate report URI
  if (options.reportUri && !options.reportUri.startsWith('http')) {
    errors.push('Report URI must be a valid HTTP(S) URL')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * CSP violation report handler types
 */
export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string
    referrer: string
    'violated-directive': string
    'effective-directive': string
    'original-policy': string
    'blocked-uri': string
    'line-number'?: number
    'column-number'?: number
    'source-file'?: string
    'status-code'?: number
  }
}

/**
 * Process CSP violation reports
 */
export function processCSPViolation(report: CSPViolationReport): {
  severity: 'low' | 'medium' | 'high'
  action: 'ignore' | 'log' | 'alert'
  reason: string
} {
  const violation = report['csp-report']
  const directive = violation['violated-directive']
  const blockedUri = violation['blocked-uri']

  // Classify violation severity
  if (directive.includes('script-src') && blockedUri.includes('javascript:')) {
    return {
      severity: 'high',
      action: 'alert',
      reason: 'Potential XSS attempt blocked',
    }
  }

  if (directive.includes('frame-ancestors')) {
    return {
      severity: 'high',
      action: 'alert',
      reason: 'Clickjacking attempt blocked',
    }
  }

  if (directive.includes('object-src') || directive.includes('frame-src')) {
    return {
      severity: 'medium',
      action: 'log',
      reason: 'Potentially malicious content blocked',
    }
  }

  if (blockedUri === 'eval' || blockedUri.includes('unsafe-eval')) {
    return {
      severity: 'low',
      action: 'log',
      reason: 'Dynamic code execution attempted',
    }
  }

  return {
    severity: 'low',
    action: 'log',
    reason: 'Standard CSP violation',
  }
}
