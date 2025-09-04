/**
 * Type-safe wrappers for database functions and stored procedures
 * This module provides strongly-typed access to custom database functions
 */

import { prisma } from './client'

import type { Role, Prisma } from '@prisma/client'

/**
 * Get a signed URL for evidence file access
 * @param filePath - Path to the file in storage
 * @returns Promise resolving to signed URL
 */
export async function getEvidenceUrl(filePath: string): Promise<string> {
  const result = await prisma.$queryRaw<[{ get_evidence_url: string }]>`
    SELECT get_evidence_url(${filePath}) as get_evidence_url
  `
  return result[0]?.get_evidence_url || ''
}

/**
 * Get user role by ID
 * @param userId - User ID to look up
 * @returns Promise resolving to user role
 */
export async function getUserRole(userId: string): Promise<Role> {
  const result = await prisma.$queryRaw<[{ get_user_role: Role }]>`
    SELECT get_user_role(${userId}) as get_user_role
  `
  return result[0]?.get_user_role || 'PARTICIPANT'
}

/**
 * Insert audit log entry
 * @param actorId - ID of user performing action
 * @param action - Action being performed
 * @param targetId - Optional target ID
 * @param meta - Optional metadata
 */
export async function insertAuditLog(
  actorId: string,
  action: string,
  targetId?: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.$executeRaw`
    SELECT insert_audit_log(${actorId}, ${action}, ${targetId || null}, ${
    meta || null
  })
  `
}

/**
 * Refresh all materialized views
 * @returns Promise resolving to refresh results
 */
export async function refreshAllMaterializedViews(): Promise<
  {
    viewName: string
    refreshDurationMs: number
    success: boolean
  }[]
> {
  const results = await prisma.$queryRaw<
    {
      view_name: string
      refresh_duration_ms: number
      success: boolean
    }[]
  >`
    SELECT * FROM refresh_all_materialized_views()
  `

  return results.map((result) => ({
    viewName: result.view_name,
    refreshDurationMs: result.refresh_duration_ms,
    success: result.success,
  }))
}

/**
 * Legacy function to refresh leaderboards specifically
 * @deprecated Use refreshAllMaterializedViews instead
 */
export async function refreshLeaderboards(): Promise<void> {
  await prisma.$executeRaw`SELECT refresh_leaderboards()`
}

/**
 * Database function result types for type safety
 */
export interface DatabaseFunctionResults {
  getEvidenceUrl: string
  getUserRole: Role
  insertAuditLog: void
  refreshAllMaterializedViews: Array<{
    viewName: string
    refreshDurationMs: number
    success: boolean
  }>
  refreshLeaderboards: void
}

/**
 * Database trigger and constraint types
 */
export interface DatabaseConstraints {
  /** Amplify quota limits */
  amplifyQuota: {
    maxPeers: 50
    maxStudents: 200
    periodDays: 7
  }
  /** LEARN submission uniqueness */
  learnSubmissionUnique: {
    /** Only one active LEARN submission per user */
    oneActivePerUser: true
  }
  /** External event ID uniqueness */
  externalEventIdUnique: {
    /** External event IDs must be globally unique */
    globallyUnique: true
  }
}

/**
 * Database trigger behaviors
 */
export interface DatabaseTriggers {
  /** Amplify quota check trigger */
  checkAmplifyQuota: {
    table: 'submissions'
    event: 'BEFORE INSERT'
    function: 'check_amplify_quota()'
  }
  /** Materialized view refresh triggers */
  refreshMaterializedViews: {
    tables: ['points_ledger', 'submissions', 'users', 'earned_badges']
    event: 'AFTER INSERT OR UPDATE OR DELETE'
    function: 'trigger_refresh_materialized_views()'
  }
}

/**
 * RLS (Row Level Security) policy types
 */
export interface RLSPolicies {
  /** Users table policies */
  users: {
    selectOwn: 'Users can select their own record'
    updateOwn: 'Users can update their own record'
    reviewerSelectAll: 'Reviewers+ can select all users'
    adminUpdateAll: 'Admins+ can update all users'
  }
  /** Submissions table policies */
  submissions: {
    selectOwn: 'Users can select their own submissions'
    selectPublic: 'Anyone can select public submissions'
    insertOwn: 'Users can insert their own submissions'
    updateOwn: 'Users can update their own submissions'
    reviewerSelectAll: 'Reviewers+ can select all submissions'
    reviewerUpdateAll: 'Reviewers+ can update all submissions'
  }
  /** Points ledger policies */
  pointsLedger: {
    selectOwn: 'Users can select their own points'
    selectPublicUser: 'Anyone can select points for public users'
    reviewerSelectAll: 'Reviewers+ can select all points'
    adminInsertAll: 'Admins+ can insert points'
  }
  /** Submission attachments policies */
  submissionAttachments: {
    selectOwn: 'Users can select attachments for their submissions'
    reviewerSelectAll: 'Reviewers+ can select all attachments'
  }
}

/**
 * Database indexes for performance optimization
 */
export interface DatabaseIndexes {
  /** Primary table indexes */
  primaryIndexes: {
    users_handle_unique: 'users(handle)'
    users_email_unique: 'users(email)'
    users_kajabi_contact_id_unique: 'users(kajabi_contact_id)'
    activities_code_pk: 'activities(code)'
    submissions_user_activity_idx: 'submissions(user_id, activity_code)'
    points_ledger_user_activity_idx: 'points_ledger(user_id, activity_code)'
    earned_badges_user_badge_unique: 'earned_badges(user_id, badge_code)'
    submission_attachments_submission_path_unique: 'submission_attachments(submission_id, path)'
  }
  /** Analytics view indexes */
  analyticsIndexes: {
    platform_stats_last_updated: 'platform_stats_overview(last_updated)'
    cohort_performance_cohort: 'cohort_performance_stats(cohort_name)'
    cohort_performance_avg_points: 'cohort_performance_stats(avg_points_per_user DESC)'
    monthly_growth_month: 'monthly_growth_stats(month)'
    monthly_growth_month_key: 'monthly_growth_stats(month_key)'
  }
}

/**
 * Database extensions enabled in the system
 */
export interface DatabaseExtensions {
  /** UUID generation */
  uuidOssp: 'uuid-ossp'
  /** Cryptographic functions */
  pgcrypto: 'pgcrypto'
}

/**
 * Complete database schema metadata
 */
export interface DatabaseMetadata {
  /** Database constraints */
  constraints: DatabaseConstraints
  /** Database triggers */
  triggers: DatabaseTriggers
  /** RLS policies */
  rlsPolicies: RLSPolicies
  /** Database indexes */
  indexes: DatabaseIndexes
  /** Database extensions */
  extensions: DatabaseExtensions
  /** Materialized views */
  materializedViews: {
    leaderboard_totals: 'All-time leaderboard with user rankings'
    leaderboard_30d: '30-day rolling leaderboard'
    metric_counts: 'Activity metrics and submission counts'
    platform_stats_overview: 'Platform-wide statistics overview'
    cohort_performance_stats: 'Performance metrics by cohort'
    monthly_growth_stats: 'Monthly growth trends (12 months)'
  }
}
