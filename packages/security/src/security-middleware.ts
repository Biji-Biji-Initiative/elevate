/**
 * Security middleware for Next.js applications
 * 
 * This middleware provides comprehensive security headers including CSP,
 * HSTS, frame protection, and other security measures.
 */

import { NextResponse, NextRequest } from 'next/server';
import type { NextMiddleware } from 'next/server';
import {
  generateNonce,
  generateSecurityHeaders,
  type CSPOptions,
  validateCSPConfig
} from './csp.js';

export interface SecurityMiddlewareOptions extends Omit<CSPOptions, 'nonce'> {
  /**
   * Skip security headers for certain paths
   */
  skipPaths?: string[] | RegExp[];
  
  /**
   * Override specific security headers
   */
  headerOverrides?: Record<string, string>;
  
  /**
   * Enable CSP reporting endpoint
   */
  enableReporting?: boolean;
  
  /**
   * Custom report URI for CSP violations
   */
  reportUri?: string;
  
  /**
   * Enable development mode features
   */
  isDevelopment?: boolean;

  /**
   * Enable CSP violation logging
   */
  logViolations?: boolean;
}

/**
 * Create security middleware with CSP and other security headers
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}): NextMiddleware {
  const {
    skipPaths = [],
    headerOverrides = {},
    enableReporting = false,
    reportUri,
    isDevelopment = process.env.NODE_ENV === 'development',
    logViolations = isDevelopment,
    ...cspOptions
  } = options;

  // Validate CSP configuration
  const validation = validateCSPConfig(cspOptions);
  if (!validation.isValid) {
    console.error('CSP Configuration Errors:', validation.errors);
    if (!isDevelopment) {
      throw new Error(`Invalid CSP configuration: ${validation.errors.join(', ')}`);
    }
  }

  return function securityMiddleware(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;

    // Check if we should skip security headers for this path
    const shouldSkip = skipPaths.some(path => {
      if (typeof path === 'string') {
        return pathname === path || pathname.startsWith(path);
      }
      return path.test(pathname);
    });

    if (shouldSkip) {
      return NextResponse.next();
    }

    // Generate a unique nonce for this request
    const nonce = generateNonce();

    // Build CSP options with nonce
    const finalCSPOptions: CSPOptions = {
      ...cspOptions,
      nonce,
      isDevelopment,
      reportUri: enableReporting && reportUri ? reportUri : undefined
    };

    // Generate all security headers
    const securityHeaders = generateSecurityHeaders(finalCSPOptions);

    // Apply header overrides
    const finalHeaders = {
      ...securityHeaders,
      ...headerOverrides
    };

    // Create response with security headers
    const response = NextResponse.next({
      request: {
        headers: new Headers({
          ...request.headers,
          'x-csp-nonce': nonce, // Make nonce available to the app
        }),
      },
    });

    // Set all security headers
    Object.entries(finalHeaders).forEach(([name, value]) => {
      if (value) {
        response.headers.set(name, value);
      }
    });

    // Add nonce to response headers for client-side access
    response.headers.set('x-csp-nonce', nonce);

    // Add cache control for security headers
    response.headers.set(
      'Cache-Control', 
      'no-cache, no-store, must-revalidate, private'
    );

    return response;
  };
}

/**
 * Create a CSP violation reporting endpoint handler
 */
export function createCSPReportHandler(options: {
  logToConsole?: boolean;
  logToDB?: boolean;
  alertOnSeverity?: 'low' | 'medium' | 'high';
  onViolation?: (violation: any) => void;
} = {}) {
  const {
    logToConsole = true,
    logToDB = false,
    alertOnSeverity = 'high',
    onViolation
  } = options;

  return async function handleCSPReport(request: NextRequest): Promise<NextResponse> {
    try {
      // Parse the CSP violation report
      const report = await request.json();
      
      if (!report || !report['csp-report']) {
        return NextResponse.json({ error: 'Invalid report format' }, { status: 400 });
      }

      const violation = report['csp-report'];
      const severity = classifyViolationSeverity(violation);

      // Log to console if enabled
      if (logToConsole) {
        const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
        console[logLevel]('CSP Violation:', {
          uri: violation['document-uri'],
          directive: violation['violated-directive'],
          blockedUri: violation['blocked-uri'],
          sourceFile: violation['source-file'],
          lineNumber: violation['line-number'],
          severity,
          timestamp: new Date().toISOString()
        });
      }

      // Store to database if enabled
      if (logToDB) {
        // You can implement database storage here
        // await storeViolationToDB(violation, severity);
      }

      // Trigger custom violation handler
      if (onViolation) {
        onViolation({ ...violation, severity });
      }

      // Alert for high severity violations
      if (severity === alertOnSeverity) {
        console.error(`HIGH SEVERITY CSP VIOLATION: ${violation['violated-directive']} - ${violation['blocked-uri']}`);
        // You could send alerts to monitoring services here
      }

      return NextResponse.json({ status: 'received' });
    } catch (error) {
      console.error('Error processing CSP report:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Classify CSP violation severity
 */
function classifyViolationSeverity(violation: any): 'low' | 'medium' | 'high' {
  const directive = violation['violated-directive'] || '';
  const blockedUri = violation['blocked-uri'] || '';

  // High severity: script injections, dangerous protocols
  if (directive.includes('script-src')) {
    if (blockedUri.includes('javascript:') || 
        blockedUri.includes('data:text/html') ||
        blockedUri.includes('vbscript:')) {
      return 'high';
    }
  }

  // High severity: frame-ancestors violations (clickjacking attempts)
  if (directive.includes('frame-ancestors')) {
    return 'high';
  }

  // Medium severity: object-src, unsafe-eval, etc.
  if (directive.includes('object-src') ||
      directive.includes('unsafe-eval') ||
      directive.includes('unsafe-inline')) {
    return 'medium';
  }

  // Medium severity: external resource loading issues
  if (directive.includes('connect-src') || 
      directive.includes('img-src') ||
      directive.includes('style-src')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Middleware configuration for different environments
 */
export const securityConfig = {
  development: {
    reportOnly: true,
    isDevelopment: true,
    enableReporting: false,
    logViolations: true,
    allowedDomains: {
      external: [
        'http://localhost:3000',
        'http://localhost:3001',
        'ws://localhost:*'
      ]
    }
  } as SecurityMiddlewareOptions,

  staging: {
    reportOnly: false,
    isDevelopment: false,
    enableReporting: true,
    reportUri: '/api/csp-report',
    logViolations: true,
    allowedDomains: {
      external: []
    }
  } as SecurityMiddlewareOptions,

  production: {
    reportOnly: false,
    isDevelopment: false,
    enableReporting: true,
    reportUri: '/api/csp-report',
    logViolations: false,
    allowedDomains: {
      external: []
    }
  } as SecurityMiddlewareOptions
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(environment?: string): SecurityMiddlewareOptions {
  const env = environment || process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return securityConfig.production;
    case 'staging':
      return securityConfig.staging;
    case 'development':
    default:
      return securityConfig.development;
  }
}

/**
 * Create a combined middleware that includes security headers
 */
export function withSecurity(
  middleware: NextMiddleware,
  securityOptions?: SecurityMiddlewareOptions
): NextMiddleware {
  const securityMiddleware = createSecurityMiddleware(securityOptions);

  return function combinedMiddleware(request: NextRequest) {
    // Apply security headers first
    const securityResponse = securityMiddleware(request);
    
    // If security middleware returns a response, combine with original middleware
    if (securityResponse instanceof NextResponse) {
      // Create request with nonce header if it exists
      const nonceHeader = securityResponse.headers.get('x-csp-nonce');
      const modifiedHeaders = new Headers(request.headers);
      if (nonceHeader) {
        modifiedHeaders.set('x-csp-nonce', nonceHeader);
      }
      
      const modifiedRequest = new NextRequest(request, {
        headers: modifiedHeaders
      });
      
      const originalResponse = middleware(modifiedRequest);
      
      // If original middleware returns a response, combine headers
      if (originalResponse instanceof NextResponse) {
        // Copy security headers to the original response
        securityResponse.headers.forEach((value, key) => {
          originalResponse.headers.set(key, value);
        });
        return originalResponse;
      }
      
      return securityResponse;
    }

    // If security middleware doesn't return a response, just apply original middleware
    return middleware(request);
  };
}

/**
 * Utility to check if request should bypass security headers
 */
export function shouldBypassSecurity(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  
  // Skip for Next.js internals
  if (pathname.startsWith('/_next/') ||
      pathname.startsWith('/api/_next/') ||
      pathname.includes('.') && !pathname.endsWith('.html')) {
    return true;
  }

  // Skip for health checks
  if (pathname === '/health' || 
      pathname === '/api/health' ||
      pathname === '/ping') {
    return true;
  }

  return false;
}

/**
 * Create CSP nonce meta tag for server-side rendering
 */
export function createNonceMetaTag(nonce: string): string {
  return `<meta name="csp-nonce" content="${nonce}" />`;
}

/**
 * Extract nonce from request headers
 */
export function extractNonce(request: NextRequest): string | null {
  return request.headers.get('x-csp-nonce');
}