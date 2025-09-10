import { NextResponse, type NextRequest } from 'next/server'

import type { LogContext } from '@elevate/logging'
import type { SafeLogger } from '@elevate/logging/safe-server'

import { getCurrentUser, requireRole, RoleError } from './withRole'

import type { RoleName, AuthUser } from './types'

// Dynamic logger initialization for server-side only
let logger: SafeLogger | null = null
const initializeLogger = async () => {
  if (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    !logger
  ) {
    try {
      const { getSafeServerLogger } = await import('@elevate/logging/safe-server')
      logger = await getSafeServerLogger('elevate-auth')
    } catch {
      // No logger available in this environment
    }
  }
}

// Initialize logger asynchronously
initializeLogger().catch(() => {
  // Silent catch: logger remains null
})

// Re-export commonly used functions
export { requireRole, getCurrentUser, RoleError } from './withRole'
export { hasRole } from './types'

/**
 * API route handler with role protection and logging
 * @param minRole Minimum required role
 * @param handler API handler function
 * @param context Optional logging context
 * @returns Protected API route handler
 */
export function createProtectedApiHandler(
  minRole: RoleName,
  handler: (
    user: AuthUser,
    req: NextRequest,
    context?: LogContext,
  ) => Promise<NextResponse>,
  context?: LogContext,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestContext = {
      ...context,
      method: req.method,
      url: req.url,
      action: 'protected_api_request',
    }

    try {
      const user = await requireRole(minRole)

      // Log successful authentication
      if (logger) {
        logger.auth(
          {
            action: 'role_check',
            userId: user.userId,
            role: user.role,
            success: true,
          },
          {
            ...requestContext,
            requiredRole: minRole,
          },
        )
      }

      const response = await handler(user, req, requestContext)
      const duration = Date.now() - startTime

      // Log successful API request
      if (logger) {
        logger.api(
          {
            method: req.method,
            url: req.url,
            statusCode: response.status,
            duration,
          },
          {
            ...requestContext,
            userId: user.userId,
            role: user.role,
          },
        )
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof RoleError) {
        // Log role-based access failure
        if (logger) {
          logger.auth(
            {
              action: 'role_check',
              success: false,
              error: error.message,
            },
            {
              ...requestContext,
              requiredRole: minRole,
              statusCode: error.statusCode,
              duration,
            },
          )
        }

        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode },
        )
      }

      if (error instanceof Error) {
        const statusCode =
          error.message === 'Unauthenticated'
            ? 401
            : error.message.startsWith('Forbidden')
            ? 403
            : 500

        // Log authentication/authorization error
        if (logger) {
          logger.error('API authentication/authorization failed', error, {
            ...requestContext,
            statusCode,
            duration,
          })
        }

        const errorMessage =
          statusCode === 401
            ? 'Authentication required'
            : statusCode === 403
            ? 'Insufficient permissions'
            : 'Internal server error'

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: statusCode },
        )
      }

      // Log unknown error
      if (logger) {
        logger.error('Unknown API error', new Error(String(error)), {
          ...requestContext,
          statusCode: 500,
          duration,
        })
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}

/**
 * Server action with role protection
 * @param minRole Minimum role required
 * @param action Server action function
 * @returns Protected server action
 */
export function createProtectedAction<TInput, TOutput>(
  minRole: RoleName,
  action: (user: AuthUser, input: TInput) => Promise<TOutput>,
) {
  return async (input: TInput): Promise<TOutput> => {
    try {
      const user = await requireRole(minRole)
      return await action(user, input)
    } catch (error) {
      if (error instanceof Error) {
        throw error // Re-throw for proper error handling in server actions
      }
      throw new Error('Unknown error occurred')
    }
  }
}

/**
 * Middleware helper for checking user authentication and role
 * @param minRole Optional minimum role required
 * @returns User object or throws error
 */
export async function validateAuth(minRole?: RoleName) {
  const user = await getCurrentUser()

  if (!user) {
    throw new RoleError('Authentication required', 401)
  }
  // Enforce minimum role if requested using the same semantics as requireRole
  if (minRole) {
    await requireRole(minRole)
  }

  return user
}

/**
 * Create error response for API routes with logging
 * @param error Error object
 * @param fallbackStatus Default status code
 * @param context Optional logging context
 * @returns NextResponse with error
 */
export function createErrorResponse(
  error: unknown,
  fallbackStatus = 500,
  context?: LogContext,
): NextResponse {
  if (error instanceof RoleError) {
    // Log role error
    if (logger) {
      logger.warn('Role error in API response', {
        ...context,
        action: 'role_error',
        error: error.message,
        statusCode: error.statusCode,
      })
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode },
    )
  }

  if (error instanceof Error) {
    // Log general error
    if (logger) {
      logger.error('API error response', error, {
        ...context,
        action: 'api_error',
        statusCode: fallbackStatus,
      })
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: fallbackStatus },
    )
  }

  // Log unknown error
  if (logger) {
    logger.error('Unknown API error response', new Error(String(error)), {
      ...context,
      action: 'unknown_error',
      statusCode: fallbackStatus,
    })
  }

  return NextResponse.json(
    { success: false, error: 'An unexpected error occurred' },
    { status: fallbackStatus },
  )
}

/**
 * Enhanced logging utilities for authentication operations
 */
export const authLogger = {
  login: (
    userId: string,
    success: boolean,
    provider?: string,
    context?: LogContext,
  ) => {
    if (logger) {
      const payload: {
        action: 'login'
        userId: string
        success: boolean
        provider?: string
      } = {
        action: 'login',
        userId,
        success,
      }
      if (typeof provider === 'string') payload.provider = provider
      logger.auth(payload, context)
    }
  },

  logout: (userId: string, context?: LogContext) => {
    if (logger) {
      logger.auth(
        {
          action: 'logout',
          userId,
          success: true,
        },
        context,
      )
    }
  },

  roleCheck: (
    userId: string,
    role: string,
    requiredRole: string,
    success: boolean,
    context?: LogContext,
  ) => {
    if (logger) {
      logger.auth(
        {
          action: 'role_check',
          userId,
          role,
          success,
        },
        {
          ...context,
          requiredRole,
        },
      )
    }
  },

  securityEvent: (
    event:
      | 'csrf_violation'
      | 'csp_violation'
      | 'rate_limit_hit'
      | 'auth_failure'
      | 'suspicious_activity',
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, unknown>,
    context?: LogContext,
  ) => {
    if (logger) {
      logger.security(
        {
          event,
          severity,
          details,
        },
        context,
      )
    }
  },
}
