import { auth } from '@clerk/nextjs/server'
import { ROLE_PERMISSIONS, ROLE_ORDER, parseClerkPublicMetadata, parseClerkEmailAddress, safeParseRole, hasRole, hasAnyRole } from './types.js'
import type { Permission, RoleName, AuthUser } from './types.js'

/**
 * Get current authenticated user with role information
 * @returns AuthUser object or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  
  const publicMetadata = parseClerkPublicMetadata(sessionClaims?.publicMetadata)
  const role = safeParseRole(publicMetadata.role)
  const email = parseClerkEmailAddress(sessionClaims?.primaryEmailAddress)
  const name = `${sessionClaims?.firstName ?? ''} ${sessionClaims?.lastName ?? ''}`.trim()
  
  return {
    userId,
    role,
    ...(email && { email }),
    ...(name && { name }),
  }
}

/**
 * Require authentication with minimum role level
 * @param minRole Minimum required role level
 * @returns AuthUser object
 * @throws RoleError with proper status codes
 */
export async function requireRole(minRole: RoleName): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new RoleError('Authentication required', 401)
  
  if (!hasRole(user.role, minRole)) {
    throw new RoleError(`Insufficient permissions: requires ${minRole} role or higher`, 403)
  }
  
  return user
}


/**
 * HOF to create role-protected API handlers
 * @param minRole Minimum required role
 * @param handler Handler function that receives AuthUser as first parameter
 * @returns Protected handler function
 */
export function withRoleProtection<T extends unknown[], R>(
  minRole: RoleName,
  handler: (user: AuthUser, ...args: T) => R | Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const user = await requireRole(minRole)
    return handler(user, ...args)
  }
}

/**
 * Role-based middleware for API routes
 */
export class RoleError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message)
    this.name = 'RoleError'
  }
}
