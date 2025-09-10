export {
  parseClerkPublicMetadata,
  parseClerkEmailAddress,
  safeParseRole,
  normalizeRole, // deprecated - kept for backward compatibility
  hasRole,
  hasAnyRole,
  hasPermission,
  roleToRoleName,
  roleNameToRole,
  ROLE_PERMISSIONS,
  ROLE_ORDER,
  type RoleName,
  type AuthUser,
  type Permission,
} from './types'
// Re-export commonly used server helpers for convenience in server-only contexts
export {
  requireRole,
  withRoleProtection as withRole,
  RoleError,
} from './withRole'
// Note: Server-side utilities are available via subpath imports:
//   - '@elevate/auth/server-helpers'
//   - '@elevate/auth/withRole'
// Client-side auth utilities are exported from './context'
// Import them using: import { AuthProvider, useAuth, ... } from '@elevate/auth/context'
