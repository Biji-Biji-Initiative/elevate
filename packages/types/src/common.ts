import { z } from 'zod'
import type { LearnInput, ExploreInput, AmplifyInput, PresentInput, ShineInput } from './schemas.js'

// Import all domain constants from single source of truth
import {
  // Types
  type ActivityCode,
  type UserRole,
  type SubmissionStatus,
  type Visibility,
  type PaginationParams,
  type ApiError,
  
  // Schemas
  ActivityCodeSchema,
  UserRoleSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  EmailSchema,
  UrlSchema,
  HandleSchema,
  CohortSchema,
  SchoolSchema,
  DateStringSchema,
  PaginationParamsSchema,
  
  // Legacy aliases for backward compatibility
  type Role,
  type ActivityCodeType,
  type RoleType,
  type SubmissionStatusType,
  type VisibilityType,
  type PaginationType,
  type ApiErrorType,
  RoleSchema,
  PaginationSchema
} from './domain-constants.js'

// Re-export domain types for backward compatibility
export type {
  ActivityCode,
  UserRole,
  SubmissionStatus,
  Visibility,
  PaginationParams,
  ApiError,
  Role,
  ActivityCodeType,
  RoleType,
  SubmissionStatusType,
  VisibilityType,
  PaginationType,
  ApiErrorType
} from './domain-constants.js'

// Re-export schemas
export {
  ActivityCodeSchema,
  UserRoleSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  EmailSchema,
  UrlSchema,
  HandleSchema,
  CohortSchema,
  SchoolSchema,
  DateStringSchema,
  PaginationParamsSchema,
  RoleSchema,
  PaginationSchema
} from './domain-constants.js'

// API Response schemas - imported from domain constants
export { ApiSuccessSchema, ApiErrorSchema, ApiResponseSchema } from './domain-constants.js'

// Helper types for API responses - using types from http.ts to avoid conflicts

// Payload union type based on activity
export type ActivityPayload = 
  | LearnInput
  | ExploreInput  
  | AmplifyInput
  | PresentInput
  | ShineInput

// Database filter types
export interface DatabaseFilter {
  startDate?: string
  endDate?: string
  cohort?: string
  role?: Role
  status?: SubmissionStatus
  activityCode?: ActivityCode
}

// Prisma where clause types
export interface UserWhereClause {
  id?: string
  email?: { contains: string; mode: 'insensitive' }
  name?: { contains: string; mode: 'insensitive' }
  handle?: { contains: string; mode: 'insensitive' }
  role?: Role | { in: Role[] }
  cohort?: string
  created_at?: {
    gte?: Date
    lte?: Date
  }
}

export interface SubmissionWhereClause {
  user_id?: string
  activity_code?: ActivityCode | { in: ActivityCode[] }
  status?: SubmissionStatus | { in: SubmissionStatus[] }
  visibility?: Visibility
  created_at?: {
    gte?: Date
    lte?: Date
  }
  user?: UserWhereClause
}

export interface PointsLedgerWhereClause {
  user_id?: string | { in: string[] }
  activity_code?: ActivityCode | { in: ActivityCode[] }
  created_at?: {
    gte?: Date
    lte?: Date
  }
  user?: UserWhereClause
}

// Analytics filter types
export interface AnalyticsDateFilter {
  created_at?: {
    gte?: Date
    lte?: Date
  }
}

export interface AnalyticsCohortFilter {
  user?: {
    cohort?: string
  }
}

export interface AnalyticsSubmissionFilter extends AnalyticsDateFilter, AnalyticsCohortFilter {}

export interface AnalyticsUserFilter {
  cohort?: string
  created_at?: {
    gte?: Date
    lte?: Date
  }
}

// API Response types
export interface AnalyticsOverview {
  submissions: SubmissionStats
  users: UserAnalyticsStats
  points: PointsStats
  badges: BadgeStats
  reviews: ReviewStats
}

export interface AnalyticsDistributions {
  submissionsByStatus: StatusDistribution[]
  submissionsByActivity: ActivityDistribution[]
  usersByRole: RoleDistribution[]
  usersByCohort: CohortDistribution[]
  pointsByActivity: PointsActivityDistribution[]
  pointsDistribution: PointsDistributionStats
}

export interface AnalyticsTrends {
  submissionsByDate: DailySubmissionStats[]
  userRegistrationsByDate: DailyRegistrationStats[]
}

export interface AnalyticsRecentActivity {
  submissions: RecentSubmission[]
  approvals: RecentApproval[]
  users: RecentUser[]
}

export interface AnalyticsPerformance {
  reviewers: ReviewerPerformance[]
  topBadges: TopBadge[]
}

export interface SubmissionStats {
  total: number
  pending: number
  approved: number
  rejected: number
  approvalRate: number
}

export interface UserAnalyticsStats {
  total: number
  active: number
  withSubmissions: number
  withBadges: number
  activationRate: number
}

export interface UserStats {
  total: number
  active: number
  byRole: Record<Role, number>
}

export interface PointsStats {
  totalAwarded: number
  totalEntries: number
  avgPerEntry: number
}

export interface BadgeStats {
  totalBadges: number
  totalEarned: number
  uniqueEarners: number
}

export interface ReviewStats {
  pendingReviews: number
  avgReviewTimeHours: number
}

export interface StatusDistribution {
  status: SubmissionStatus
  count: number
}

export interface ActivityDistribution {
  activity: ActivityCode
  activityName: string
  count: number
}

export interface RoleDistribution {
  role: Role
  count: number
}

export interface CohortDistribution {
  cohort: string
  count: number
}

export interface PointsActivityDistribution {
  activity: ActivityCode
  activityName: string
  totalPoints: number
  entries: number
}

export interface PointsDistributionStats {
  totalUsers: number
  max: number
  min: number
  avg: number
  percentiles: Array<{
    percentile: number
    value: number
  }>
}

export interface DailySubmissionStats {
  date: string
  total: number
  approved: number
  rejected: number
  pending: number
}

export interface DailyRegistrationStats {
  date: string
  count: number
}

export interface RecentSubmission {
  id: string
  user_id: string
  activity_code: ActivityCode
  status: SubmissionStatus
  created_at: Date
  user: {
    name: string
    handle: string
  }
  activity: {
    name: string
  }
}

export interface RecentApproval {
  id: string
  user_id: string
  activity_code: ActivityCode
  status: SubmissionStatus
  updated_at: Date
  user: {
    name: string
    handle: string
  }
  activity: {
    name: string
  }
}

export interface RecentUser {
  id: string
  name: string
  handle: string
  email: string
  role: Role
  created_at: Date
}

export interface ReviewerPerformance {
  id: string
  name: string
  handle: string
  role: Role
  approved: number
  rejected: number
  total: number
}

export interface TopBadge {
  badge: {
    code: string
    name: string
    description: string
    criteria: unknown
    icon_url?: string
  }
  earnedCount: number
}

// Review and audit types
export interface ReviewAction {
  action: 'approve' | 'reject'
  points?: number
  note?: string
}

export interface AuditMeta {
  submissionId?: string
  pointsAwarded?: number
  reviewNote?: string
  previousStatus?: SubmissionStatus
  newStatus?: SubmissionStatus
  [key: string]: unknown
}

// Badge criteria schema and types  
export const BadgeConditionsSchema = z.record(z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number())
]))

export const BadgeCriteriaSchema = z.object({
  type: z.enum(['points', 'submissions', 'activities', 'streak']),
  threshold: z.number().positive(),
  activity_codes: z.array(z.string()).optional(),
  conditions: BadgeConditionsSchema.optional()
})

export const BadgeSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  criteria: BadgeCriteriaSchema,
  icon_url: z.string().url().optional()
})

export type BadgeCriteria = z.infer<typeof BadgeCriteriaSchema>
export type BadgeInput = z.infer<typeof BadgeSchema>

// Badge audit log metadata
export const BadgeAuditMetaSchema = z.object({
  badgeName: z.string().optional(),
  criteria: BadgeCriteriaSchema.optional(),
  updates: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  original: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
})

export type BadgeAuditMeta = z.infer<typeof BadgeAuditMetaSchema>

// Comprehensive audit log metadata schemas
export const SubmissionAuditMetaSchema = z.object({
  submissionId: z.string().optional(),
  pointsAwarded: z.number().optional(),
  reviewNote: z.string().optional(),
  previousStatus: SubmissionStatusSchema.optional(),
  newStatus: SubmissionStatusSchema.optional(),
  submissionType: ActivityCodeSchema.optional(),
  pointAdjustment: z.number().optional(),
  bulkOperation: z.boolean().optional(),
  basePoints: z.number().optional(),
  adjustedPoints: z.number().optional(),
  reason: z.string().optional()
})

export const UserAuditMetaSchema = z.object({
  changes: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    handle: z.string().optional(),
    school: z.string().optional(),
    cohort: z.string().optional(),
    role: RoleSchema.optional(),
    profileVisible: z.boolean().optional()
  }).optional(),
  originalRole: RoleSchema.optional(),
  newRole: RoleSchema.optional(),
  bulkOperation: z.boolean().optional()
})

export const ExportAuditMetaSchema = z.object({
  type: z.string().optional(),
  format: z.string().optional(),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    activity: z.string().optional(),
    status: z.string().optional(),
    cohort: z.string().optional()
  }).optional()
})

export const KajabiAuditMetaSchema = z.object({
  event_id: z.string().optional(),
  tag_name: z.string().optional(),
  kajabi_contact_id: z.number().optional(),
  points_awarded: z.number().optional(),
  reprocessed_at: z.string().optional(),
  processed_at: z.string().optional(),
  user_id: z.string().optional(),
  email: z.string().optional()
})

// Union type for all possible audit metadata
export const AuditMetaUnionSchema = z.union([
  SubmissionAuditMetaSchema,
  UserAuditMetaSchema,
  BadgeAuditMetaSchema,
  ExportAuditMetaSchema,
  KajabiAuditMetaSchema,
  z.object({
    // Fallback for generic metadata with known fields
    action: z.string().optional(),
    entityId: z.string().optional(),
    entityType: z.string().optional(),
    timestamp: z.string().optional(),
    additionalInfo: z.string().optional()
  })
])

export type SubmissionAuditMeta = z.infer<typeof SubmissionAuditMetaSchema>
export type UserAuditMeta = z.infer<typeof UserAuditMetaSchema>
export type ExportAuditMeta = z.infer<typeof ExportAuditMetaSchema>
export type KajabiAuditMeta = z.infer<typeof KajabiAuditMetaSchema>
export type AuditMetaUnion = z.infer<typeof AuditMetaUnionSchema>

// Note: Kajabi webhook types moved to webhooks.ts for better organization

// User with role metadata
export interface UserWithRole {
  userId: string
  role: Role
  email?: string
  name?: string
}

// Pagination types - using imported types from domain constants
// PaginationParams and PaginatedResult types are imported above
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// CSV export row types
export interface UserExportRow {
  id: string
  handle: string
  name: string
  email: string
  role: Role
  school?: string
  cohort?: string
  total_points: number
  submissions_count: number
  created_at: string
}

export interface SubmissionExportRow {
  id: string
  user_id: string
  user_name: string
  user_email: string
  activity_code: ActivityCode
  status: SubmissionStatus
  visibility: Visibility
  points_awarded: number
  reviewer_name?: string
  created_at: string
  reviewed_at?: string
}

export interface PointsExportRow {
  id: string
  user_id: string
  user_name: string
  user_email: string
  activity_code: ActivityCode
  delta_points: number
  source: string
  external_source?: string
  created_at: string
}

// Storage metadata type
export interface StorageMetadata {
  userId?: string
  submissionId?: string
  activityCode?: ActivityCode
  originalName?: string
  mimeType?: string
  [key: string]: string | number | boolean | undefined
}

// Safe parser functions - use imported schemas from domain constants
export function parseRole(value: unknown): Role | null {
  const result = RoleSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseSubmissionStatus(value: unknown): SubmissionStatus | null {
  const result = SubmissionStatusSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseVisibility(value: unknown): Visibility | null {
  const result = VisibilitySchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseActivityCode(value: unknown): ActivityCode | null {
  const result = ActivityCodeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseEmail(value: unknown): string | null {
  const result = EmailSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseUrl(value: unknown): string | null {
  const result = UrlSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseHandle(value: unknown): string | null {
  const result = HandleSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCohort(value: unknown): string | null {
  const result = CohortSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseSchool(value: unknown): string | null {
  const result = SchoolSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseDateString(value: unknown): string | null {
  const result = DateStringSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parsePagination(value: unknown): PaginationType | null {
  const result = PaginationSchema.safeParse(value)
  return result.success ? result.data : null
}

// API Response helper functions - use apiSuccess and apiError from http.ts to avoid conflicts

export function parseApiResponse<T>(value: unknown, dataSchema: z.ZodType<T>): unknown {
  const result = z.union([
    z.object({ success: z.literal(true), data: dataSchema, message: z.string().optional() }),
    z.object({ success: z.literal(false), error: z.string(), details: z.object({
      code: z.string().optional(),
      field: z.string().optional(),
      traceId: z.string().optional(),
      timestamp: z.string().optional(),
      validationErrors: z.array(z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
        code: z.string()
      })).optional()
    }).optional() })
  ]).safeParse(value)
  return result.success ? result.data : null
}

// Safe JSON parsing functions
export function safeParseJSON<T>(json: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = JSON.parse(json)
    const result = schema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function safeParseUnknown<T>(value: unknown, schema: z.ZodType<T>): T | null {
  const result = schema.safeParse(value)
  return result.success ? result.data : null
}

// Utility functions for safe parsing with error details
export function parseWithErrors<T>(value: unknown, schema: z.ZodType<T>): { data: T | null; errors: z.ZodIssue[] } {
  const result = schema.safeParse(value)
  return {
    data: result.success ? result.data : null,
    errors: result.success ? [] : result.error.issues
  }
}

export function parseJSONWithErrors<T>(json: string, schema: z.ZodType<T>): { data: T | null; errors: z.ZodIssue[] } {
  try {
    const parsed = JSON.parse(json)
    return parseWithErrors(parsed, schema)
  } catch (parseError) {
    return {
      data: null,
      errors: [{
        code: 'custom',
        message: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        path: []
      }]
    }
  }
}

// Badge-specific parser functions
export function parseBadgeCriteria(value: unknown): BadgeCriteria | null {
  const result = BadgeCriteriaSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseBadgeInput(value: unknown): BadgeInput | null {
  const result = BadgeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseBadgeAuditMeta(value: unknown): BadgeAuditMeta | null {
  const result = BadgeAuditMetaSchema.safeParse(value)
  return result.success ? result.data : null
}

// Audit metadata parser functions
export function parseSubmissionAuditMeta(value: unknown): SubmissionAuditMeta | null {
  const result = SubmissionAuditMetaSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseUserAuditMeta(value: unknown): UserAuditMeta | null {
  const result = UserAuditMetaSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseExportAuditMeta(value: unknown): ExportAuditMeta | null {
  const result = ExportAuditMetaSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseKajabiAuditMeta(value: unknown): KajabiAuditMeta | null {
  const result = KajabiAuditMetaSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseAuditMeta(value: unknown): AuditMetaUnion | null {
  const result = AuditMetaUnionSchema.safeParse(value)
  return result.success ? result.data : null
}

// JSON helpers for domain usage (no Prisma types)
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonObject = { [k: string]: JsonValue }
export type JsonArray = JsonValue[]

export function toJsonValue(value: unknown): JsonValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value === 'object') {
    const obj: JsonObject = {}
    for (const [k, v] of Object.entries(value)) obj[k] = toJsonValue(v)
    return obj
  }
  // Fallback for other types
  return String(value)
}

// Prisma-specific JSON value conversion
// This function safely converts any value to Prisma.InputJsonValue
export function toPrismaJson(value: unknown): JsonValue {
  // Use toJsonValue for the actual conversion since Prisma.InputJsonValue
  // has the same shape as our JsonValue type
  return toJsonValue(value)
}

// Audit meta helper to standardize envelope keys
export type AuditEntityType = 'submission' | 'user' | 'badge' | 'export' | 'kajabi' | 'points' | 'cohort'

export function buildAuditMeta(
  envelope: { entityType: AuditEntityType; entityId: string },
  meta?: Record<string, unknown>
): JsonValue {
  return toPrismaJson({ ...envelope, ...(meta ?? {}) })
}
