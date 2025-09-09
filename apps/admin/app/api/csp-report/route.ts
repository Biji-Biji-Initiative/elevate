/**
 * CSP Violation Reporting Endpoint for Admin App
 * 
 * This endpoint receives Content Security Policy violation reports and logs them
 * for monitoring and debugging purposes. Admin app specific handling.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { createErrorResponse } from '@elevate/http'
import { getServerLogger } from '@elevate/logging/server'
import { createCSPReportHandler } from '@elevate/security/security-middleware'
import { wrapError } from '@elevate/utils'

// Create CSP report handler with admin app specific configuration
const handleCSPReport = createCSPReportHandler({
  logToConsole: true,
  logToDB: false, // Can be enabled later with database integration
  alertOnSeverity: 'medium', // More sensitive for admin app
  onViolation: (violation) => {
    const logger = getServerLogger({ name: 'admin-csp' })
    // Custom handling for admin app violations
    if (violation.severity === 'high' || violation.severity === 'medium') {
      logger.security({
        event: 'csp_violation',
        severity: violation.severity || 'medium',
        details: {
          directive: violation['violated-directive'],
          blockedUri: violation['blocked-uri'],
          documentUri: violation['document-uri'],
          sourceFile: violation['source-file'],
          lineNumber: violation['line-number'],
          timestamp: new Date().toISOString(),
          userAgent: violation.userAgent || 'unknown',
          adminContext: true,
        },
      })

      // Admin violations might be more concerning - log with more detail
      if (violation['violated-directive']?.includes('script-src')) {
        logger.warn('Script injection attempt detected in admin panel')
      }

      // In production, send immediate alerts for admin violations
      // await sendUrgentAlertToMonitoring(violation);
    }

    // Track violations for security analysis
    if (process.env.NODE_ENV === 'production') {
      // await trackCSPViolation('admin', violation);
    }
  }
});

/**
 * Handle CSP violation reports for admin app
 * 
 * @param request - The incoming request with violation report
 * @returns Response indicating receipt of the report
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/csp-report') && 
        !contentType?.includes('application/json')) {
      return createErrorResponse(new Error('Invalid content type. Expected application/csp-report or application/json'), 400)
    }

    // Enhanced security for admin app - log all reports
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    getServerLogger({ name: 'admin-csp' }).info('CSP Report received in Admin App', {
      clientIP,
      userAgent,
      timestamp: new Date().toISOString(),
      url: request.url
    })

    // Stricter rate limiting for admin app
    // Implementation would be environment-specific

    // Process the violation report
    return await handleCSPReport(request);
  } catch (error: unknown) {
    getServerLogger({ name: 'admin-csp' }).error('Error in Admin CSP report handler', wrapError(error, 'Admin CSP report error'))
    
    // Don't expose internal errors to clients
    return createErrorResponse(new Error('Internal server error'), 500)
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 * CSP reports can come from any origin that loads our content, so we allow all origins
 * but only for this specific non-credentialed endpoint.
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
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
  const res = createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
  res.headers.set('Allow', 'POST, OPTIONS')
  return res
}

export async function PUT(): Promise<NextResponse> {
  const res = createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
  res.headers.set('Allow', 'POST, OPTIONS')
  return res
}

export async function DELETE(): Promise<NextResponse> {
  const res = createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
  res.headers.set('Allow', 'POST, OPTIONS')
  return res
}

export async function PATCH(): Promise<NextResponse> {
  const res = createErrorResponse(new Error('Method not allowed. This endpoint only accepts POST requests for CSP violation reports.'), 405)
  res.headers.set('Allow', 'POST, OPTIONS')
  return res
}
