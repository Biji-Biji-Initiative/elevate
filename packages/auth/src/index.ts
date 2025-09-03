// Server-side auth utilities
export {
  getCurrentUser,
  requireRole,
  withRoleProtection,
  RoleError,
} from './withRole.js'

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
} from './types.js'

export {
  createProtectedApiHandler,
  createProtectedAction,
  validateAuth,
  createErrorResponse,
} from './server-helpers.js'

// Note: Client-side auth utilities are now exported from './context.js' 
// Import them using: import { AuthProvider, useAuth, ... } from '@elevate/auth/context'
