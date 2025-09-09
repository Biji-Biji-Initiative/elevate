/**
 * CSP Violation Reporting Endpoint for Web App
 * 
 * This endpoint receives Content Security Policy violation reports and logs them
 * for monitoring and debugging purposes.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { createErrorResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createCSPReportHandler } from '@elevate/security/security-middleware'

// Initialize logger
let logger: Awaited<ReturnType<typeof getSafeServerLogger>> | null = null
void (async () => {
  try {
    logger = await getSafeServerLogger('csp-report')
  } catch {
    console.warn('Failed to initialize CSP report logger, falling back to console')
  }
})()

// Create CSP report handler with web app specific configuration
const handleCSPReport = createCSPReportHandler({
  logToConsole: true,
  logToDB: false, // Can be enabled later with database integration
  alertOnSeverity: 'high',
  onViolation: (violation) => {
    // Log CSP violations with structured logging
    if (logger) {
      const details = {
        directive: violation['violated-directive'],
        blockedUri: violation['blocked-uri'],
        documentUri: violation['document-uri'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        userAgent: violation.userAgent || 'unknown',
        app: 'web',
      }
      logger.warn('CSP violation detected', {
        action: 'csp_violation_detected',
        component: 'security',
        details,
        severity: violation.severity || 'medium',
      })
      if (violation.severity === 'high') {
        logger.error('High severity CSP violation detected', new Error('CSP Violation'), {
          action: 'csp_high_severity',
          details: violation,
        })
      }
    } else {
      // Fallback to console logging
      if (violation.severity === 'high') {
        console.error('🚨 HIGH SEVERITY CSP VIOLATION in Web App:', {
          directive: violation['violated-directive'],
          blockedUri: violation['blocked-uri'],
          documentUri: violation['document-uri'],
          sourceFile: violation['source-file'],
          lineNumber: violation['line-number'],
          timestamp: new Date().toISOString(),
          userAgent: violation.userAgent || 'unknown'
        });
      }
    }

    // Track violations for analytics (optional)
    if (process.env.NODE_ENV === 'production') {
      // await trackCSPViolation('web', violation);
    }
  }
});

/**
 * Handle CSP violation reports
 * 
 * @param request - The incoming request with violation report
 * @returns Response indicating receipt of the report
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Hoist clientIP outside try block for error handler access
  const clientIP = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';
  
  try {
    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/csp-report') && 
        !contentType?.includes('application/json')) {
      return createErrorResponse(new Error('Invalid content type. Expected application/csp-report or application/json'), 400)
    }

    // Rate limiting check (basic implementation)
    
    // Simple in-memory rate limiting (in production, use Redis or similar)
    // const rateLimitKey = `csp-report:${clientIP}`;
    // Implementation would depend on your rate limiting strategy

    // Process the violation report
    return await handleCSPReport(request);
  } catch (error) {
    // Log error with structured logging
    if (logger) {
      logger.error('CSP report handler error', error as Error, {
        action: 'csp_report_error',
        component: 'security',
        clientIP
      });
    } else {
      console.error('Error in CSP report handler:', error);
    }
    
    // Don't expose internal errors to clients
    return createErrorResponse(new Error('Internal server error'), 500)
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 * CSP reports can come from any origin that loads our content, so we allow all origins
 * but only for this specific non-credentialed endpoint.
 */
export async function OPTIONS(_request: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  
  // CSP reports can come from any origin that loads our content
  // This is safe because this endpoint doesn't use credentials
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  response.headers.set('Vary', 'Origin'); // Add for cache correctness
  
  return response;
}

/**
 * Reject other HTTP methods
 */
export async function GET(): Promise<NextResponse> {
  return createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
}

export async function PUT(): Promise<NextResponse> {
  return createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
}

export async function DELETE(): Promise<NextResponse> {
  return createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
}

export async function PATCH(): Promise<NextResponse> {
  return createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
}
