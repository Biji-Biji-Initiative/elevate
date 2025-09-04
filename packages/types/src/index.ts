export * from './schemas.js'
export * from './canonical-urls.js'
export * from './domain-constants.js'
export * from './submission-payloads.js'
export * from './webhooks.js'
export * from './ui-types.js'
export * from './api-types.js'
export * from './dto-mappers.js'

// Re-export specific items from common to avoid conflicts
export {
  toJsonValue,
  toPrismaJson,
  buildAuditMeta,
  capitalize,
  toSafeEnum
} from './common.js'

// Re-export specific items from type-guards to avoid conflicts
export {
  isSubmissionStatus,
  isRole,
  isActivityCode,
  isRecord,
  isBoolean,
  validate,
  safeJsonParse,
  assertDefined,
  assertUnreachable
} from './type-guards.js'
// Avoid duplicate re-exports for symbols that also exist in common.ts
export {
  // ActivityCodeEnum, SubmissionStatusEnum, VisibilityEnum, RoleEnum now exported from domain-constants
  ActivitySchema,
  UserMiniSchema,
  SubmissionAttachmentRelSchema as SubmissionAttachmentSchema,
  AdminSubmissionSchema,
  SubmissionsListResponseSchema,
  SubmissionDetailResponseSchema,
  AdminUserSchema,
  UsersListResponseSchema,
  AdminBadgeSchema,
  BadgesListResponseSchema,
  OverviewStatsSchema,
  DistributionsSchema,
  TrendsSchema,
  RecentActivitySchema,
  PerformanceSchema,
  AnalyticsResponseSchema,
  KajabiEventSchema,
  KajabiStatsSchema,
  KajabiResponseSchema,
  SubmissionsQuerySchema,
  UsersQuerySchema,
  AnalyticsQuerySchema,
} from './admin-api-types.js'
export * from './query-schemas.js'
export * from './http.js'
export * from './admin-schemas.js'
export * from './errors.js'

// Re-export commonly used types
export type { AmplifyInput } from './schemas.js'
