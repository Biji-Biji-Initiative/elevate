/**
 * Content Security Policy (CSP) utilities for the MS Elevate LEAPS Tracker
 * 
 * This module provides comprehensive CSP generation and management for secure
 * operation with Clerk authentication, Supabase storage, and Next.js requirements.
 */

import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';

export interface CSPOptions {
  nonce?: string;
  isDevelopment?: boolean;
  reportOnly?: boolean;
  reportUri?: string;
  allowedDomains?: {
    clerk?: string[];
    supabase?: string[];
    fonts?: string[];
    images?: string[];
    analytics?: string[];
    external?: string[];
  };
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'Content-Security-Policy-Report-Only'?: string;
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security'?: string;
  'X-XSS-Protection': string;
  'X-DNS-Prefetch-Control': string;
  'X-Permitted-Cross-Domain-Policies'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Build Content Security Policy directives
 */
export function buildCSPDirectives(options: CSPOptions = {}): string {
  const {
    nonce,
    isDevelopment = process.env.NODE_ENV === 'development',
    allowedDomains = {}
  } = options;

  // Base domains for different services
  const clerkDomains = [
    'https://clerk.dev',
    'https://*.clerk.dev',
    'https://images.clerk.dev',
    'https://img.clerk.com',
    'https://api.clerk.dev',
    'https://*.clerk.com',
    ...(allowedDomains.clerk || [])
  ];

  const supabaseDomains = [
    'https://*.supabase.co',
    'https://*.supabase.in',
    ...(allowedDomains.supabase || [])
  ];

  const fontDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    ...(allowedDomains.fonts || [])
  ];

  const imageDomains = [
    'data:',
    'https://res.cloudinary.com',
    ...clerkDomains,
    ...supabaseDomains,
    ...(allowedDomains.images || [])
  ];

  const analyticsDomains = [
    'https://vitals.vercel-analytics.com',
    'https://vercel-insights.com',
    'https://*.sentry.io',
    ...(allowedDomains.analytics || [])
  ];

  const externalDomains = allowedDomains.external || [];

  // Build CSP directives
  const directives: Record<string, string[]> = {
    // Default source - restrict to self and essential domains
    'default-src': ['\'self\''],

    // Script sources - includes Next.js requirements and nonce
    'script-src': [
      '\'self\'',
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      '\'unsafe-eval\'', // Required for Next.js development
      '\'unsafe-inline\'', // Required for some Next.js inline scripts
      'https://vercel.live',
      ...clerkDomains,
      ...analyticsDomains,
      ...(isDevelopment ? ['\'unsafe-eval\'', 'webpack:'] : [])
    ],

    // Style sources - includes inline styles and font providers
    'style-src': [
      '\'self\'',
      '\'unsafe-inline\'', // Required for CSS-in-JS libraries like styled-components
      ...fontDomains,
      ...clerkDomains
    ],

    // Image sources - comprehensive list for all image providers
    'img-src': [
      '\'self\'',
      'blob:',
      'data:',
      ...imageDomains
    ],

    // Font sources - web fonts and icon fonts
    'font-src': [
      '\'self\'',
      'data:',
      ...fontDomains
    ],

    // Connect sources - APIs and WebSockets
    'connect-src': [
      '\'self\'',
      ...clerkDomains,
      ...supabaseDomains,
      ...analyticsDomains,
      'https://vitals.vercel-analytics.com',
      'wss://*.supabase.co', // Supabase realtime
      ...(isDevelopment ? ['ws://localhost:*', 'http://localhost:*'] : []),
      ...externalDomains
    ],

    // Media sources - for audio/video content
    'media-src': [
      '\'self\'',
      'blob:',
      'data:',
      ...supabaseDomains
    ],

    // Object sources - plugins and embeds (restricted)
    'object-src': ['\'none\''],

    // Frame sources - iframes (restricted to essential services)
    'frame-src': [
      '\'self\'',
      ...clerkDomains,
      'https://vercel.live' // Vercel preview comments
    ],

    // Child sources - web workers and frames
    'child-src': [
      '\'self\'',
      'blob:'
    ],

    // Worker sources - service workers and web workers
    'worker-src': [
      '\'self\'',
      'blob:'
    ],

    // Manifest sources - web app manifest
    'manifest-src': ['\'self\''],

    // Base URI - restrict base tag
    'base-uri': ['\'self\''],

    // Form action - restrict form submissions
    'form-action': [
      '\'self\'',
      ...clerkDomains,
      ...supabaseDomains
    ],

    // Frame ancestors - prevent clickjacking
    'frame-ancestors': ['\'none\''],

    // Upgrade insecure requests in production
    ...(isDevelopment ? {} : { 'upgrade-insecure-requests': [] })
  };

  // Convert directives object to CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => {
      const sourceList = sources.length > 0 ? ` ${sources.join(' ')}` : '';
      return `${directive}${sourceList}`;
    })
    .join('; ');
}

/**
 * Generate all security headers
 */
export function generateSecurityHeaders(options: CSPOptions = {}): SecurityHeaders {
  const {
    reportOnly = false,
    reportUri,
    isDevelopment = process.env.NODE_ENV === 'development'
  } = options;

  const cspValue = buildCSPDirectives(options) + 
    (reportUri ? `; report-uri ${reportUri}` : '');

  const headers: SecurityHeaders = {
    // CSP header (either enforcing or report-only)
    ...(reportOnly 
      ? { 'Content-Security-Policy-Report-Only': cspValue }
      : { 'Content-Security-Policy': cspValue }
    ),

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
      'xr-spatial-tracking=()'
    ].join(', '),

    // Legacy XSS protection (still useful for older browsers)
    'X-XSS-Protection': '1; mode=block',

    // Control DNS prefetching
    'X-DNS-Prefetch-Control': 'on'
  };

  // Add HSTS in production with longer max-age and security optimizations
  if (!isDevelopment) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  // Additional modern security headers
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';
  headers['Cross-Origin-Embedder-Policy'] = 'credentialless';
  headers['Cross-Origin-Opener-Policy'] = 'same-origin';
  headers['Cross-Origin-Resource-Policy'] = 'same-origin';

  return headers;
}

/**
 * Apply security headers to a Response object
 */
export function applySecurityHeaders(response: Response, options: CSPOptions = {}): Response {
  const headers = generateSecurityHeaders(options);
  
  Object.entries(headers).forEach(([name, value]) => {
    if (value) {
      response.headers.set(name, value);
    }
  });

  return response;
}

/**
 * Create CSP middleware for Next.js
 */
export function createCSPMiddleware(options: Omit<CSPOptions, 'nonce'> = {}) {
  return function cspMiddleware(request: NextRequest, response: Response): Response {
    // Generate a unique nonce for each request
    const nonce = generateNonce();
    
    // Store nonce in request headers for use in components
    const modifiedRequest = new Request(request, {
      headers: {
        ...request.headers,
        'x-csp-nonce': nonce
      }
    });

    // Apply security headers with nonce
    const securedResponse = applySecurityHeaders(response, {
      ...options,
      nonce
    });

    return securedResponse;
  };
}

/**
 * Extract nonce from request headers (for use in React components)
 */
export function getNonceFromRequest(request: NextRequest | Request): string | undefined {
  return request.headers.get('x-csp-nonce') || undefined;
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(options: CSPOptions): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for common misconfigurations
  if (options.allowedDomains?.external) {
    const external = options.allowedDomains.external;
    for (const domain of external) {
      if (!domain.startsWith('https://') && !domain.startsWith('http://')) {
        errors.push(`External domain "${domain}" should include protocol (https:// or http://)`);
      }
      if (domain.includes('*') && !domain.startsWith('https://*.')) {
        errors.push(`Wildcard domain "${domain}" should be properly formatted (e.g., https://*.example.com)`);
      }
    }
  }

  // Validate report URI
  if (options.reportUri && !options.reportUri.startsWith('http')) {
    errors.push('Report URI must be a valid HTTP(S) URL');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * CSP violation report handler types
 */
export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    'referrer': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri': string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
  };
}

/**
 * Process CSP violation reports
 */
export function processCSPViolation(report: CSPViolationReport): {
  severity: 'low' | 'medium' | 'high';
  action: 'ignore' | 'log' | 'alert';
  reason: string;
} {
  const violation = report['csp-report'];
  const directive = violation['violated-directive'];
  const blockedUri = violation['blocked-uri'];

  // Classify violation severity
  if (directive.includes('script-src') && blockedUri.includes('javascript:')) {
    return {
      severity: 'high',
      action: 'alert',
      reason: 'Potential XSS attempt blocked'
    };
  }

  if (directive.includes('frame-ancestors')) {
    return {
      severity: 'high',
      action: 'alert',
      reason: 'Clickjacking attempt blocked'
    };
  }

  if (directive.includes('object-src') || directive.includes('frame-src')) {
    return {
      severity: 'medium',
      action: 'log',
      reason: 'Potentially malicious content blocked'
    };
  }

  if (blockedUri === 'eval' || blockedUri.includes('unsafe-eval')) {
    return {
      severity: 'low',
      action: 'log',
      reason: 'Dynamic code execution attempted'
    };
  }

  return {
    severity: 'low',
    action: 'log',
    reason: 'Standard CSP violation'
  };
}