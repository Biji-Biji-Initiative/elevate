// Shared types that can be used in both client and server contexts

export const ROLE_ORDER = ['participant', 'reviewer', 'admin', 'superadmin'] as const
export type RoleName = (typeof ROLE_ORDER)[number]

export interface AuthUser {
  userId: string
  role: RoleName
  email?: string
  name?: string
}

export const ROLE_PERMISSIONS = {
  participant: ['view_profile', 'submit_evidence', 'view_leaderboard'],
  reviewer: [
    'view_profile', 'submit_evidence', 'view_leaderboard',
    'review_submissions', 'approve_submissions', 'reject_submissions'
  ],
  admin: [
    'view_profile', 'submit_evidence', 'view_leaderboard',
    'review_submissions', 'approve_submissions', 'reject_submissions',
    'manage_users', 'view_analytics', 'export_data', 'manage_badges'
  ],
  superadmin: [
    'view_profile', 'submit_evidence', 'view_leaderboard',
    'review_submissions', 'approve_submissions', 'reject_submissions',
    'manage_users', 'view_analytics', 'export_data', 'manage_badges',
    'manage_system', 'manage_roles'
  ]
} as const

export type Permission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS][number]

/**
 * Normalize role string to valid RoleName
 */
export function normalizeRole(role?: string): RoleName {
  const normalized = role?.toLowerCase()
  return ROLE_ORDER.includes(normalized as RoleName) ? (normalized as RoleName) : 'participant'
}

/**
 * Check if user has required role or higher
 */
export function hasRole(userRole: RoleName, requiredRole: RoleName): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(requiredRole)
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(userRole: RoleName, requiredRoles: RoleName[]): boolean {
  return requiredRoles.some(role => hasRole(userRole, role))
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userRole: RoleName, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[userRole] as readonly string[]).includes(permission)
}