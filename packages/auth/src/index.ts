// Server-side auth utilities
export {
  getCurrentUser,
  requireRole,
  hasRole,
  hasAnyRole,
  hasPermission,
  normalizeRole,
  withRoleProtection,
  RoleError,
  type RoleName,
  type AuthUser,
} from '../withRole'

export {
  ROLE_PERMISSIONS,
  type Permission,
} from '../types'

export {
  createProtectedApiHandler,
  createProtectedAction,
  validateAuth,
  createErrorResponse,
} from '../server-helpers'

// Client-side auth utilities
export {
  AuthProvider,
  useAuth,
  useRequireAuth,
  RoleGuard,
  PermissionGuard,
  withRoleGuard,
} from '../context'