export * from './schemas'
export * from './canonical-urls'
// Export from domain-constants but avoid ApiResponse conflict
export {
  ACTIVITY_CODES,
  LEARN,
  EXPLORE,
  AMPLIFY,
  PRESENT,
  SHINE,
  USER_ROLES,
  USER_TYPES,
  SUBMISSION_STATUSES,
  VISIBILITY_OPTIONS,
  LEDGER_SOURCES,
  ActivityCodeSchema,
  UserRoleSchema,
  UserTypeSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  LedgerSourceSchema,
  HANDLE_REGEX,
  HANDLE_ERROR_MESSAGE,
  HandleSchema,
  EmailSchema,
  UrlSchema,
  CohortSchema,
  SchoolSchema,
  DateTimeWithOffsetSchema,
  DateStringSchema,
  PaginationParamsSchema,
  PaginatedResponseSchema,
  ACTIVITY_FILTER_OPTIONS,
  ActivityFilterSchema,
  STATUS_FILTER_OPTIONS,
  StatusFilterSchema,
  ROLE_FILTER_OPTIONS,
  RoleFilterSchema,
  ApiSuccessSchema,
  ApiErrorSchema,
  ApiResponseSchema,
  LIMITS,
  DEFAULTS,
  DomainSchemas,
  RoleSchema,
  ActivityCodeEnum,
  RoleEnum,
  UserTypeEnum,
  SubmissionStatusEnum,
  VisibilityEnum,
  PaginationSchema,
} from './domain-constants'
export type {
  ActivityCode,
  UserRole,
  UserType,
  SubmissionStatus,
  Visibility,
  LedgerSource,
  PaginationParams,
  PaginatedResponse,
  ActivityFilterOption,
  StatusFilterOption,
  RoleFilterOption,
  Role,
  ActivityCodeType,
  RoleType,
  UserTypeType,
  SubmissionStatusType,
  VisibilityType,
  PaginationType,
} from './domain-constants'
export * from './submission-payloads'
export * from './webhooks'
export * from './ui-types'
export * from './dto-mappers'
export * from './analytics-views'
export * from './request-schemas'
export * from './logging-schemas'
export type { ErrorEnvelope, ErrorEnvelopeType } from './error-envelope'

// Re-export specific items from common to avoid conflicts
export {
  toJsonValue,
  toPrismaJson,
  buildAuditMeta,
  parseRole,
  parseSubmissionStatus,
  parseActivityCode,
  BadgeCriteriaSchema,
} from './common'
export type { TopBadge } from './common'

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
  assertUnreachable,
} from './type-guards'
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
} from './admin-api-types'
export * from './query-schemas'
// Export http utilities (not API response types - those come from errors.ts)
export {
  createHeaders,
  mergeHeaders,
  addAuthHeader,
  httpSuccess,
  httpError,
  // Legacy function aliases for backward compatibility
  apiSuccess,
  apiError,
} from './http'
export type { HttpSuccess, HttpError } from './http'
export * from './admin-schemas'
// Export domain API response types - errors.ts is the source of truth
export type { 
  ApiSuccessResponse as ApiSuccess, 
  ApiErrorResponse as ApiError,
  ApiResponse
} from './errors'
export {
  ErrorCodes,
  ErrorSeverity,
  ErrorStatusCodes,
  ErrorSeverityMap,
  ElevateApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  SubmissionLimitError,
  ReferralError,
  FileValidationError,
  ExternalServiceError,
  ForbiddenError,
  APIError,
} from './errors'
export type { ErrorCode, ErrorSeverityLevel } from './errors'
// Do not re-export ApiResponse alias from http to avoid ambiguity with domain-constants

// Re-export commonly used types
export type { AmplifyInput } from './schemas'

// Environment types are exported via env.d.ts ambient declarations
