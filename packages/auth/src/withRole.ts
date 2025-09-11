import { auth } from '@clerk/nextjs/server'

import {
  parseClerkPublicMetadata,
  safeParseRole,
  hasRole,
  type RoleName,
  type AuthUser,
} from './types'

/**
 * Get current authenticated user with role information
 * @returns AuthUser object or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null

  const publicMetadata = parseClerkPublicMetadata(
    (sessionClaims as unknown as { publicMetadata?: unknown })?.publicMetadata,
  )
  let role = safeParseRole(publicMetadata.role)
  // In Clerk v6, email might be in different places in sessionClaims
  const emailRaw =
    (sessionClaims as Record<string, unknown> | undefined)?.email ??
    (sessionClaims as Record<string, unknown> | undefined)?.primaryEmailAddress ??
    (sessionClaims as Record<string, unknown> | undefined)?.emailAddress
  const email = typeof emailRaw === 'string' ? emailRaw : undefined
  const first = typeof (sessionClaims as Record<string, unknown> | undefined)?.firstName === 'string'
    ? ((sessionClaims as Record<string, unknown>).firstName as string)
    : ''
  const last = typeof (sessionClaims as Record<string, unknown> | undefined)?.lastName === 'string'
    ? ((sessionClaims as Record<string, unknown>).lastName as string)
    : ''
  const name = `${first} ${last}`.trim()

  // Development-only override: if the signed-in email is listed in
  // NEXT_PUBLIC_ADMIN_EMAILS, elevate to superadmin locally to unblock
  // developer access without editing Clerk metadata. Never applies in prod.
  if (process.env.NODE_ENV === 'development' && email) {
    const csv = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').toLowerCase()
    if (csv.length > 0) {
      const allow = new Set(
        csv
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      )
      if (allow.has(email.toLowerCase())) {
        role = 'superadmin'
      }
    }
  }

  // Development-only override: hardcoded userId bypass for development
  if (process.env.NODE_ENV === 'development') {
    const devAdminUserIds = ['user_328teXv7Od0N4I9ck6W7Q65SuaL']
    if (devAdminUserIds.includes(userId)) {
      role = 'superadmin'
    }
  }

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
    throw new RoleError(
      `Insufficient permissions: requires ${minRole} role or higher`,
      403,
    )
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
  handler: (user: AuthUser, ...args: T) => R | Promise<R>,
) {
  return async (...args: T): Promise<R> => {
    const user = await requireRole(minRole)
    return handler(user, ...args)
  }
}

// Backward-compatible alias used across apps
export { withRoleProtection as withRole }

/**
 * Role-based middleware for API routes
 */
export class RoleError extends Error {
  constructor(message: string, public statusCode = 403) {
    super(message)
    this.name = 'RoleError'
  }
}
