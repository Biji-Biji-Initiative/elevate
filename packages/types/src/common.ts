import { z } from 'zod'
import { type Role, type SubmissionStatus, type Visibility } from '@prisma/client'
import type { LearnInput, ExploreInput, AmplifyInput, PresentInput, ShineInput } from './schemas'

// Activity types
export type ActivityCode = 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'

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

// Kajabi webhook types
export interface KajabiContact {
  id: number
  email: string
  first_name?: string
  last_name?: string
  tags?: string[]
}

export interface KajabiTagEvent {
  event_type: 'tag.added' | 'tag.removed'
  contact: KajabiContact
  tag: {
    name: string
  }
}

// User with role metadata
export interface UserWithRole {
  userId: string
  role: Role
  email?: string
  name?: string
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
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