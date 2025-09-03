import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireRole, RoleError } from './withRole.js'
import type { RoleName, AuthUser } from './types.js'

// Re-export commonly used functions
export { requireRole, getCurrentUser, RoleError } from './withRole.js'
export { hasRole } from './types.js'

/**
 * API route handler with role protection
 * @param minRole Minimum required role
 * @param handler API handler function
 * @returns Protected API route handler
 */
export function createProtectedApiHandler(
  minRole: RoleName,
  handler: (user: AuthUser, req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const user = await requireRole(minRole)
      return await handler(user, req)
    } catch (error) {
      if (error instanceof RoleError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        )
      }
      
      if (error instanceof Error) {
        if (error.message === 'Unauthenticated') {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }
        
        if (error.message.startsWith('Forbidden')) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Server action with role protection
 * @param minRole Minimum required role
 * @param action Server action function
 * @returns Protected server action
 */
export function createProtectedAction<TInput, TOutput>(
  minRole: RoleName,
  action: (user: AuthUser, input: TInput) => Promise<TOutput>
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
 * Create error response for API routes
 * @param error Error object
 * @param fallbackStatus Default status code
 * @returns NextResponse with error
 */
export function createErrorResponse(error: unknown, fallbackStatus: number = 500): NextResponse {
  if (error instanceof RoleError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: fallbackStatus }
    )
  }
  
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: fallbackStatus }
  )
}
