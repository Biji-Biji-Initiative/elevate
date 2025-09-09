import { z } from 'zod'

/**
 * DOMAIN CONSTANTS - Single Source of Truth
 * 
 * This file contains all canonical domain constants to prevent type drift.
 * All other files should import from here rather than defining their own versions.
 * 
 * DO NOT duplicate these definitions in other files.
 */

// =============================================================================
// CORE ENUMS - Single source definitions
// =============================================================================

/**
 * Activity codes for the LEAPS framework stages
 */
export const ACTIVITY_CODES = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'] as const
export type ActivityCode = typeof ACTIVITY_CODES[number]
export const ActivityCodeSchema = z.enum(ACTIVITY_CODES)

// Named exports for each activity code to replace hardcoded array indexes
export const LEARN = ACTIVITY_CODES[0]           // 'LEARN'
export const EXPLORE = ACTIVITY_CODES[1]         // 'EXPLORE' 
export const AMPLIFY = ACTIVITY_CODES[2]         // 'AMPLIFY'
export const PRESENT = ACTIVITY_CODES[3]         // 'PRESENT'
export const SHINE = ACTIVITY_CODES[4]           // 'SHINE'

/**
 * User roles in the system
 */
export const USER_ROLES = ['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'] as const
export type UserRole = typeof USER_ROLES[number]
export const UserRoleSchema = z.enum(USER_ROLES)

/**
 * User types distinguish educators from students
 */
export const USER_TYPES = ['EDUCATOR', 'STUDENT'] as const
export type UserType = typeof USER_TYPES[number]
export const UserTypeSchema = z.enum(USER_TYPES)

/**
 * Submission review statuses
 */
export const SUBMISSION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'] as const
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number]
export const SubmissionStatusSchema = z.enum(SUBMISSION_STATUSES)

/**
 * Visibility settings for submissions and profiles
 */
export const VISIBILITY_OPTIONS = ['PRIVATE', 'PUBLIC'] as const
export type Visibility = typeof VISIBILITY_OPTIONS[number]
export const VisibilitySchema = z.enum(VISIBILITY_OPTIONS)

/**
 * Sources for points ledger entries
 */
export const LEDGER_SOURCES = ['MANUAL', 'WEBHOOK', 'FORM'] as const
export type LedgerSource = typeof LEDGER_SOURCES[number]
export const LedgerSourceSchema = z.enum(LEDGER_SOURCES)

// =============================================================================
// VALIDATION PATTERNS - Canonical regex patterns
// =============================================================================

/**
 * Handle validation - consistent across the entire system
 * Pattern: 3-30 characters, letters, numbers, underscores, hyphens
 * Case insensitive matching
 */
export const HANDLE_REGEX = /^[a-zA-Z0-9_-]{3,30}$/
export const HANDLE_ERROR_MESSAGE = 'Handle must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
export const HandleSchema = z.string()
  .min(3, 'Handle must be at least 3 characters')
  .max(30, 'Handle must be at most 30 characters')
  .regex(HANDLE_REGEX, HANDLE_ERROR_MESSAGE)

/**
 * Email validation - RFC compliant
 */
export const EmailSchema = z.string().email('Invalid email address')

/**
 * URL validation - must be valid HTTP/HTTPS URL
 */
export const UrlSchema = z.string().url('Invalid URL format')

/**
 * Cohort validation
 */
export const CohortSchema = z.string().min(1, 'Cohort is required').max(100, 'Cohort must be at most 100 characters')

/**
 * School validation
 */
export const SchoolSchema = z.string().min(1, 'School is required').max(200, 'School must be at most 200 characters')

// =============================================================================
// DATE/TIME HANDLING - ISO 8601 with timezone
// =============================================================================

/**
 * Standard date string format - ISO 8601 with timezone offset
 * Used for consistent date handling across admin interfaces
 */
export const DateTimeWithOffsetSchema = z.string().datetime({ offset: true })

/**
 * Basic date string validation - for simpler use cases
 */
export const DateStringSchema = z.string().refine(
  (date: string) => !isNaN(Date.parse(date)), 
  'Invalid date string'
)

// =============================================================================
// PAGINATION - Consistent structure across all APIs
// =============================================================================

/**
 * Standard pagination parameters
 */
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).optional()
})

/**
 * Standard paginated response structure
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  data: z.array(dataSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0)
})

// =============================================================================
// COMMON QUERY PATTERNS - Reusable for filtering
// =============================================================================

/**
 * Activity filter options - includes 'ALL' for admin interfaces
 */
export const ACTIVITY_FILTER_OPTIONS = ['ALL', ...ACTIVITY_CODES] as const
export type ActivityFilterOption = typeof ACTIVITY_FILTER_OPTIONS[number]
export const ActivityFilterSchema = z.enum(ACTIVITY_FILTER_OPTIONS)

/**
 * Status filter options - includes 'ALL' for admin interfaces  
 */
export const STATUS_FILTER_OPTIONS = ['ALL', ...SUBMISSION_STATUSES] as const
export type StatusFilterOption = typeof STATUS_FILTER_OPTIONS[number]
export const StatusFilterSchema = z.enum(STATUS_FILTER_OPTIONS)

/**
 * Role filter options - includes 'ALL' for admin interfaces
 */
export const ROLE_FILTER_OPTIONS = ['ALL', ...USER_ROLES] as const
export type RoleFilterOption = typeof ROLE_FILTER_OPTIONS[number]
export const RoleFilterSchema = z.enum(ROLE_FILTER_OPTIONS)

// =============================================================================
// API RESPONSE PATTERNS - Consistent structure
// =============================================================================

/**
 * Standard API success response
 */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: dataSchema,
  message: z.string().optional()
})

/**
 * Standard API error response
 */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.object({
    code: z.string().optional(),
    field: z.string().optional(),
    traceId: z.string().optional(),
    timestamp: z.string().optional(),
    validationErrors: z.array(z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
      code: z.string()
    })).optional()
  }).optional()
})

/**
 * Discriminated union for all API responses
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.discriminatedUnion('success', [
  ApiSuccessSchema(dataSchema),
  ApiErrorSchema
])

// =============================================================================
// TYPE EXPORTS - Inferred from schemas for consistency
// =============================================================================

export type PaginationParams = z.infer<typeof PaginationParamsSchema>
export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ApiSuccess<T> = {
  success: true
  data: T
  message?: string
}

export type ApiError = z.infer<typeof ApiErrorSchema>

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// =============================================================================
// UTILITY CONSTANTS
// =============================================================================

/**
 * Common limits and constraints
 */
export const LIMITS = {
  // Text fields
  HANDLE_MIN: 3,
  HANDLE_MAX: 30,
  EMAIL_MAX: 254,
  NAME_MAX: 200,
  SCHOOL_MAX: 200,
  COHORT_MAX: 100,
  
  // Pagination
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  
  // Review notes
  REVIEW_NOTE_MAX: 1000,
  
  // Point adjustments
  POINT_ADJUSTMENT_MIN: -1000,
  POINT_ADJUSTMENT_MAX: 1000,
  
  // Bulk operations
  BULK_USERS_MAX: 100,
  BULK_SUBMISSIONS_MAX: 50,
  
  // Badge assignments
  BULK_BADGE_ASSIGNMENTS_MAX: 100
} as const

/**
 * Default values
 */
export const DEFAULTS = {
  PAGINATION_PAGE: 1,
  PAGINATION_LIMIT: 20,
  LEADERBOARD_PERIOD: 'all' as const,
  ADMIN_SUBMISSIONS_STATUS: 'PENDING' as const,
  ADMIN_SUBMISSIONS_ACTIVITY: 'ALL' as const,
  ADMIN_USERS_ROLE: 'ALL' as const,
  SORT_ORDER: 'desc' as const
} as const

/**
 * Export all schemas in a convenient object for bulk imports
 */
export const DomainSchemas = {
  // Core enums
  ActivityCode: ActivityCodeSchema,
  UserRole: UserRoleSchema,
  UserType: UserTypeSchema,
  SubmissionStatus: SubmissionStatusSchema,
  Visibility: VisibilitySchema,
  LedgerSource: LedgerSourceSchema,
  
  // Validation patterns
  Handle: HandleSchema,
  Email: EmailSchema,
  Url: UrlSchema,
  Cohort: CohortSchema,
  School: SchoolSchema,
  
  // Date/time
  DateTimeWithOffset: DateTimeWithOffsetSchema,
  DateString: DateStringSchema,
  
  // Pagination
  PaginationParams: PaginationParamsSchema,
  
  // Filters
  ActivityFilter: ActivityFilterSchema,
  StatusFilter: StatusFilterSchema,
  RoleFilter: RoleFilterSchema,
  
  // API responses
  ApiSuccess: ApiSuccessSchema,
  ApiError: ApiErrorSchema,
  ApiResponse: ApiResponseSchema
} as const

/**
 * Legacy type aliases for backward compatibility
 * These match the original type names from common.ts
 */
export type Role = UserRole
export type ActivityCodeType = ActivityCode
export type RoleType = UserRole
export type UserTypeType = UserType
export type SubmissionStatusType = SubmissionStatus
export type VisibilityType = Visibility
export type PaginationType = PaginationParams

// Re-export schemas with legacy names for backward compatibility
export const RoleSchema = UserRoleSchema
export const ActivityCodeEnum = ActivityCodeSchema
export const RoleEnum = UserRoleSchema
export const UserTypeEnum = UserTypeSchema
export const SubmissionStatusEnum = SubmissionStatusSchema
export const VisibilityEnum = VisibilitySchema
export const PaginationSchema = PaginationParamsSchema

// =============================================================================
// UTILITY VALIDATION FUNCTIONS - Type-safe constant validation
// =============================================================================

/**
 * Type-safe validation functions for domain constants
 * Use these instead of string comparisons for better type safety
 */

/**
 * Check if a value is a valid activity code
 */
export const isValidActivityCode = (value: string): value is ActivityCode => {
  return ACTIVITY_CODES.includes(value as ActivityCode)
}

/**
 * Check if a value is a valid user role
 */
export const isValidUserRole = (value: string): value is UserRole => {
  return USER_ROLES.includes(value as UserRole)
}

/**
 * Check if a value is a valid user type
 */
export const isValidUserType = (value: string): value is UserType => {
  return USER_TYPES.includes(value as UserType)
}

/**
 * Check if a value is a valid submission status
 */
export const isValidSubmissionStatus = (value: string): value is SubmissionStatus => {
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus)
}

/**
 * Check if a value is a valid visibility option
 */
export const isValidVisibility = (value: string): value is Visibility => {
  return VISIBILITY_OPTIONS.includes(value as Visibility)
}

/**
 * Check if a value is a valid ledger source
 */
export const isValidLedgerSource = (value: string): value is LedgerSource => {
  return LEDGER_SOURCES.includes(value as LedgerSource)
}

/**
 * Get all activity codes as readonly array
 */
export const getAllActivityCodes = (): readonly ActivityCode[] => ACTIVITY_CODES

/**
 * Get all user roles as readonly array
 */
export const getAllUserRoles = (): readonly UserRole[] => USER_ROLES

/**
 * Get all user types as readonly array
 */
export const getAllUserTypes = (): readonly UserType[] => USER_TYPES

/**
 * Get all submission statuses as readonly array
 */
export const getAllSubmissionStatuses = (): readonly SubmissionStatus[] => SUBMISSION_STATUSES

/**
 * Get all visibility options as readonly array
 */
export const getAllVisibilityOptions = (): readonly Visibility[] => VISIBILITY_OPTIONS

/**
 * Get all ledger sources as readonly array
 */
export const getAllLedgerSources = (): readonly LedgerSource[] => LEDGER_SOURCES