/**
 * Security middleware for Next.js applications
 *
 * This middleware provides comprehensive security headers including CSP,
 * HSTS, frame protection, and other security measures.
 */

import {
  NextResponse,
  type NextRequest,
  type NextMiddleware,
} from 'next/server'

import {
  generateNonce,
  generateSecurityHeaders,
  type CSPOptions,
  validateCSPConfig,
} from './csp'

export interface SecurityMiddlewareOptions extends Omit<CSPOptions, 'nonce'> {
  /**
   * Skip security headers for certain paths
   */
  skipPaths?: (string | RegExp)[]

  /**
   * Override specific security headers
   */
  headerOverrides?: Record<string, string>

  /**
   * Enable CSP reporting endpoint
   */
  enableReporting?: boolean

  /**
   * Custom report URI for CSP violations
   */
  reportUri?: string

  /**
   * Enable development mode features
   */
  isDevelopment?: boolean

  /**
   * Enable CSP violation logging
   */
  logViolations?: boolean
}

/**
 * Create security middleware with CSP and other security headers
 */
export function createSecurityMiddleware(
  options: SecurityMiddlewareOptions = {},
): NextMiddleware {
  const {
    skipPaths = [],
    headerOverrides = {},
    enableReporting = false,
    reportUri,
    isDevelopment = process.env.NODE_ENV === 'development',
    logViolations: _logViolations = isDevelopment,
    ...cspOptions
  } = options

  // Validate CSP configuration
  const validation = validateCSPConfig(cspOptions)
  if (!validation.isValid) {
    console.error('CSP Configuration Errors:', validation.errors)
    if (!isDevelopment) {
      throw new Error(
        `Invalid CSP configuration: ${validation.errors.join(', ')}`,
      )
    }
  }

  return function securityMiddleware(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl

    // Check if we should skip security headers for this path
    const shouldSkip = skipPaths.some((path) => {
      if (typeof path === 'string') {
        return pathname === path || pathname.startsWith(path)
      }
      return path.test(pathname)
    })

    if (shouldSkip) {
      return NextResponse.next()
    }

    // Generate a unique nonce for this request
    const nonce = generateNonce()

    // Build CSP options with nonce
    const finalCSPOptions: CSPOptions = {
      ...cspOptions,
      nonce,
      isDevelopment,
      ...(enableReporting && reportUri ? { reportUri } : {}),
    }

    // Generate all security headers
    const securityHeaders = generateSecurityHeaders(finalCSPOptions)

    // Apply header overrides
    const finalHeaders = {
      ...securityHeaders,
      ...headerOverrides,
    }

    // Create response with security headers
    const response = NextResponse.next({
      request: {
        headers: new Headers({
          ...request.headers,
          'x-csp-nonce': nonce, // Make nonce available to the app
        }),
      },
    })

    // Set all security headers
    Object.entries(finalHeaders).forEach(([name, value]) => {
      if (value) {
        response.headers.set(name, value)
      }
    })

    // Add nonce to response headers for client-side access
    response.headers.set('x-csp-nonce', nonce)

    // Add cache control for security headers
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, private',
    )

    return response
  }
}

/**
 * Create a CSP violation reporting endpoint handler
 */
export function createCSPReportHandler(
  options: {
    logToConsole?: boolean
    logToDB?: boolean
    alertOnSeverity?: 'low' | 'medium' | 'high'
    onViolation?: (
      violation: Record<string, unknown> & {
        severity?: 'low' | 'medium' | 'high'
      },
    ) => void
  } = {},
) {
  const {
    logToConsole = true,
    logToDB = false,
    alertOnSeverity = 'high',
    onViolation,
  } = options

  return async function handleCSPReport(
    request: NextRequest,
  ): Promise<NextResponse> {
    try {
      // Parse the CSP violation report
      const raw: unknown = await request.json()

      if (!raw || typeof raw !== 'object' || !('csp-report' in raw)) {
        return NextResponse.json(
          { error: 'Invalid report format' },
          { status: 400 },
        )
      }

      const violation = (raw as Record<string, unknown>)['csp-report']
      if (!violation || typeof violation !== 'object') {
        return NextResponse.json(
          { error: 'Invalid violation payload' },
          { status: 400 },
        )
      }
      const severity = classifyViolationSeverity(
        violation as Record<string, unknown>,
      )

      // Log to console if enabled
      if (logToConsole) {
        const logLevel =
          severity === 'high'
            ? 'error'
            : severity === 'medium'
            ? 'warn'
            : 'info'
        console[logLevel]('CSP Violation:', {
          uri: String(
            (violation as { ['document-uri']?: unknown })['document-uri'] ?? '',
          ),
          directive: String(
            (violation as { ['violated-directive']?: unknown })[
              'violated-directive'
            ] ?? '',
          ),
          blockedUri: String(
            (violation as { ['blocked-uri']?: unknown })['blocked-uri'] ?? '',
          ),
          sourceFile: String(
            (violation as { ['source-file']?: unknown })['source-file'] ?? '',
          ),
          lineNumber: String(
            (violation as { ['line-number']?: unknown })['line-number'] ?? '',
          ),
          severity,
          timestamp: new Date().toISOString(),
        })
      }

      // Store to database if enabled
      if (logToDB) {
        // You can implement database storage here
        // await storeViolationToDB(violation, severity);
      }

      // Trigger custom violation handler
      if (onViolation) {
        onViolation({ ...(violation as Record<string, unknown>), severity })
      }

      // Alert for high severity violations
      if (severity === alertOnSeverity) {
        const directive = String(
          (violation as { ['violated-directive']?: unknown })[
            'violated-directive'
          ] ?? '',
        )
        const blocked = String(
          (violation as { ['blocked-uri']?: unknown })['blocked-uri'] ?? '',
        )
        console.error(`HIGH SEVERITY CSP VIOLATION: ${directive} - ${blocked}`)
        // You could send alerts to monitoring services here
      }

      return NextResponse.json({ status: 'received' })
    } catch (error) {
      console.error('Error processing CSP report:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}

/**
 * Classify CSP violation severity
 */
function classifyViolationSeverity(
  violation: Record<string, unknown>,
): 'low' | 'medium' | 'high' {
  const directive = String(
    (violation as { ['violated-directive']?: unknown })['violated-directive'] ??
      '',
  )
  const blockedUri = String(
    (violation as { ['blocked-uri']?: unknown })['blocked-uri'] ?? '',
  )

  // High severity: script injections, dangerous protocols
  if (directive.includes('script-src')) {
    if (
      blockedUri.includes('javascript:') ||
      blockedUri.includes('data:text/html') ||
      blockedUri.includes('vbscript:')
    ) {
      return 'high'
    }
  }

  // High severity: frame-ancestors violations (clickjacking attempts)
  if (directive.includes('frame-ancestors')) {
    return 'high'
  }

  // Medium severity: object-src, unsafe-eval, etc.
  if (
    directive.includes('object-src') ||
    directive.includes('unsafe-eval') ||
    directive.includes('unsafe-inline')
  ) {
    return 'medium'
  }

  // Medium severity: external resource loading issues
  if (
    directive.includes('connect-src') ||
    directive.includes('img-src') ||
    directive.includes('style-src')
  ) {
    return 'medium'
  }

  return 'low'
}

/**
 * Middleware configuration for different environments
 */
export const securityConfig = {
  development: {
    // In development, enforce CSP to avoid noisy browser warnings and to
    // surface violations early. The directives already allow dev tooling
    // (e.g., 'unsafe-eval' for Next.js) when isDevelopment=true.
    reportOnly: false,
    isDevelopment: true,
    enableReporting: false,
    logViolations: true,
    allowedDomains: {
      external: ['http://localhost:3000', 'http://localhost:3001'],
    },
  } as SecurityMiddlewareOptions,

  staging: {
    reportOnly: false,
    isDevelopment: false,
    enableReporting: true,
    reportUri: '/api/csp-report',
    logViolations: true,
    allowedDomains: {
      external: [],
    },
  } as SecurityMiddlewareOptions,

  production: {
    reportOnly: false,
    isDevelopment: false,
    enableReporting: true,
    reportUri: '/api/csp-report',
    logViolations: false,
    allowedDomains: {
      external: [],
    },
  } as SecurityMiddlewareOptions,
}

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(
  environment?: string,
): SecurityMiddlewareOptions {
  const env = environment || process.env.NODE_ENV || 'development'

  switch (env) {
    case 'production':
      return securityConfig.production
    case 'staging':
      return securityConfig.staging
    case 'development':
    default:
      return securityConfig.development
  }
}

/**
 * Create a combined middleware that includes security headers
 */
export function withSecurity(
  middleware: NextMiddleware,
  securityOptions?: SecurityMiddlewareOptions,
): NextMiddleware {
  return function combinedMiddleware(
    request: NextRequest,
    event: Parameters<NextMiddleware>[1],
  ) {
    // Run app middleware FIRST so framework middlewares (e.g. Clerk) can
    // annotate the request. Do not reconstruct the request.
    const result = middleware(request, event)

    // Normalize to a NextResponse to attach headers
    const response =
      result instanceof NextResponse ? result : NextResponse.next()

    // Generate security headers and attach to the response only (no request overrides)
    const nonce = generateNonce()
    const headers = generateSecurityHeaders({
      ...(securityOptions || {}),
      nonce,
    })

    Object.entries(headers).forEach(([k, v]) => {
      if (typeof v === 'string') {
        response.headers.set(k, v)
      }
    })
    response.headers.set('x-csp-nonce', nonce)
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, private',
    )

    return response
  }
}

/**
 * Utility to check if request should bypass security headers
 */
export function shouldBypassSecurity(request: NextRequest): boolean {
  const { pathname } = request.nextUrl

  // Skip for Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/') ||
    (pathname.includes('.') && !pathname.endsWith('.html'))
  ) {
    return true
  }

  // Skip for health checks
  if (
    pathname === '/health' ||
    pathname === '/api/health' ||
    pathname === '/ping'
  ) {
    return true
  }

  return false
}

/**
 * Create CSP nonce meta tag for server-side rendering
 */
export function createNonceMetaTag(nonce: string): string {
  return `<meta name="csp-nonce" content="${nonce}" />`
}

/**
 * Extract nonce from request headers
 */
export function extractNonce(request: NextRequest): string | null {
  return request.headers.get('x-csp-nonce')
}
