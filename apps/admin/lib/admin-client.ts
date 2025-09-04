// Re-export from consolidated admin-core package
export { 
  adminActions as adminClient,
  AdminClientError,
  type AdminSubmission, 
  type AdminUser, 
  type AdminBadge, 
  type KajabiEvent, 
  type KajabiStats, 
  type SubmissionsQuery, 
  type UsersQuery, 
  type AnalyticsQuery 
} from '@elevate/admin-core/actions'