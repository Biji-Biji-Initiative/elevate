// Shared types that can be used in both client and server contexts
import { parseRole, type Role } from '@elevate/types'

// Map Prisma Role enum to lowercase for UI
const ROLE_MAPPING: Record<Role, 'participant' | 'reviewer' | 'admin' | 'superadmin'> = {
  PARTICIPANT: 'participant',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
} as const

export const ROLE_ORDER = ['participant', 'reviewer', 'admin', 'superadmin'] as const
export type RoleName = (typeof ROLE_ORDER)[number]

// Utility to convert Prisma Role to lowercase RoleName
export function roleToRoleName(role: Role): RoleName {
  return ROLE_MAPPING[role]
}

// Utility to convert RoleName back to Prisma Role
const ROLE_NAME_TO_ROLE: Record<RoleName, Role> = {
  participant: 'PARTICIPANT',
  reviewer: 'REVIEWER',
  admin: 'ADMIN',
  superadmin: 'SUPERADMIN',
}

export function roleNameToRole(roleName: RoleName): Role {
  return ROLE_NAME_TO_ROLE[roleName]
}

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
 * Safely parse role from unknown input and return as RoleName
 * This replaces the old normalizeRole to be more type-safe
 */
export function safeParseRole(role?: unknown): RoleName {
  // First try to parse as Prisma Role enum
  const parsedRole = parseRole(role)
  if (parsedRole) {
    return roleToRoleName(parsedRole)
  }
  
  // Fallback: try to match lowercase string directly
  if (typeof role === 'string') {
    const normalized = role.toLowerCase() as RoleName
    if (ROLE_ORDER.includes(normalized)) {
      return normalized
    }
  }
  
  return 'participant'
}

/**
 * @deprecated Use safeParseRole instead for better type safety
 * Normalize role string to valid RoleName
 */
export function normalizeRole(role?: string): RoleName {
  return safeParseRole(role)
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

/**
 * Safely parse Clerk publicMetadata
 */
export function parseClerkPublicMetadata(metadata: unknown): { role?: string } {
  if (!metadata || typeof metadata !== 'object' || metadata === null) {
    return {}
  }
  
  // Type-safe property access
  if ('role' in metadata && typeof metadata.role === 'string') {
    return { role: metadata.role }
  }
  
  return {}
}

/**
 * Safely parse Clerk email address from session claims
 */
export function parseClerkEmailAddress(emailAddress: unknown): string | undefined {
  if (!emailAddress || typeof emailAddress !== 'object' || emailAddress === null) {
    return undefined
  }
  
  // Type-safe property access
  if ('emailAddress' in emailAddress && typeof emailAddress.emailAddress === 'string') {
    return emailAddress.emailAddress
  }
  
  return undefined
}
