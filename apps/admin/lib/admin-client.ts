// Strongly-typed admin client sourced from consolidated admin-core package
import {
  adminActions,
  AdminClientError,
  type AdminSubmission,
  type AdminUser,
  type AdminBadge,
  type KajabiEvent,
  type KajabiStats,
  type Pagination,
  type SubmissionsQuery,
  type UsersQuery,
  type AnalyticsQuery,
} from '@elevate/admin-core/actions'

export const adminClient = adminActions

export { AdminClientError }
export type {
  AdminSubmission,
  AdminUser,
  AdminBadge,
  KajabiEvent,
  KajabiStats,
  Pagination,
  SubmissionsQuery,
  UsersQuery,
  AnalyticsQuery,
}
