import { auth } from '@clerk/nextjs/server'

const ROLE_ORDER = ['participant', 'reviewer', 'admin', 'superadmin'] as const
export type RoleName = (typeof ROLE_ORDER)[number]

export interface AuthUser {
  userId: string
  role: RoleName
  email?: string
  name?: string
}

/**
 * Get current authenticated user with role information
 * @returns AuthUser object or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId, sessionClaims } = auth()
  if (!userId) return null
  
  const role = normalizeRole((sessionClaims?.publicMetadata as any)?.role)
  const email = (sessionClaims?.primaryEmailAddress as any)?.emailAddress
  const name = `${sessionClaims?.firstName || ''} ${sessionClaims?.lastName || ''}`.trim()
  
  return {
    userId,
    role,
    email,
    name: name || undefined,
  }
}

/**
 * Require authentication with minimum role level
 * @param minRole Minimum required role level
 * @returns AuthUser object
 * @throws Error if unauthenticated or insufficient role
 */
export async function requireRole(minRole: RoleName): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthenticated')
  
  if (!hasRole(user.role, minRole)) {
    throw new Error(`Forbidden: requires ${minRole} role or higher`)
  }
  
  return user
}

/**
 * Check if a user has at least the specified role level
 * @param userRole Current user role
 * @param requiredRole Required minimum role
 * @returns true if user has sufficient role
 */
export function hasRole(userRole: RoleName, requiredRole: RoleName): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(requiredRole)
}

/**
 * Normalize role string to valid RoleName
 * @param role Role string from metadata
 * @returns Valid RoleName (defaults to 'participant')
 */
export function normalizeRole(role?: string): RoleName {
  const normalizedRole = role?.toLowerCase() as RoleName
  return ROLE_ORDER.includes(normalizedRole) ? normalizedRole : 'participant'
}

/**
 * Check if user has any of the specified roles
 * @param userRole Current user role
 * @param allowedRoles Array of allowed roles
 * @returns true if user has any of the allowed roles
 */
export function hasAnyRole(userRole: RoleName, allowedRoles: RoleName[]): boolean {
  return allowedRoles.some(role => hasRole(userRole, role))
}

/**
 * HOF to create role-protected API handlers
 * @param minRole Minimum required role
 * @param handler Handler function that receives AuthUser as first parameter
 * @returns Protected handler function
 */
export function withRoleProtection<T extends any[], R>(
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

export const ROLE_PERMISSIONS = {
  participant: ['view_own_profile', 'submit_evidence', 'view_leaderboard'],
  reviewer: ['review_submissions', 'approve_submissions', 'view_all_submissions'],
  admin: ['manage_users', 'view_analytics', 'export_data', 'manage_badges'],
  superadmin: ['system_config', 'manage_roles', 'access_logs'],
} as const

export type Permission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS][number]

/**
 * Check if user role has specific permission
 * @param userRole Current user role
 * @param permission Permission to check
 * @returns true if role has permission
 */
export function hasPermission(userRole: RoleName, permission: Permission): boolean {
  // Higher roles inherit all lower role permissions
  for (let i = ROLE_ORDER.indexOf(userRole); i >= 0; i--) {
    const role = ROLE_ORDER[i]
    if (ROLE_PERMISSIONS[role].includes(permission as any)) {
      return true
    }
  }
  return false
}
