import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import {
  createSuccessResponse,
  createErrorResponse,
  withApiErrorHandling,
  AuthenticationError,
} from '@elevate/http'
import { generateCSRFToken } from '@elevate/security/csrf'

export const runtime = 'nodejs'

/**
 * GET /api/csrf-token
 *
 * Generates a new CSRF token for the current user session.
 * The secret is set as an httpOnly cookie, and the token is returned in the response.
 * This endpoint is used by the useCSRFToken React hook.
 */
export const GET = withApiErrorHandling(
  async (request: NextRequest, context) => {
    const { userId } = await auth()

    // Require authentication for CSRF token generation
    // This prevents anonymous users from consuming server resources
    if (!userId) {
      throw new AuthenticationError()
    }

    try {
      // Generate CSRF token and set cookie
      const token = await generateCSRFToken()

      return createSuccessResponse({
        token,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      })
    } catch (error) {
      return createErrorResponse(
        'Failed to generate CSRF token',
        500,
        'CSRF_GENERATION_FAILED',
        context.traceId,
      )
    }
  },
)
