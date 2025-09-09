/**
 * Database service layer - Pure data access without transformations
 * This layer provides raw database operations and returns Prisma models as-is
 * DTO transformations should be handled at the API layer
 */

import { 
  Prisma,
  type User,
  type Submission,
  type Activity,
  type Badge,
  type EarnedBadge,
  type PointsLedger,
  type SubmissionAttachment,
  type AuditLog,
  type KajabiEvent,
  type SubmissionStatus,
  type Visibility,
  type Role,
  type LedgerSource,
} from '@prisma/client'

import { prisma } from './client'

// Transaction utilities
export type TransactionClient = Prisma.TransactionClient
export type TransactionFunction<T> = (tx: TransactionClient) => Promise<T>

// Transaction wrapper functions
export async function runTransaction<T>(
  fn: TransactionFunction<T>,
): Promise<T> {
  return await prisma.$transaction(fn)
}

export async function runTransactionWithTimeout<T>(
  fn: TransactionFunction<T>,
  timeoutMs = 5000,
): Promise<T> {
  return await prisma.$transaction(fn, {
    maxWait: timeoutMs,
    timeout: timeoutMs,
  })
}

// Service interfaces for complex queries
export interface UserWithRelations extends User {
  submissions?: (Submission & { activity: Activity })[]
  earned_badges?: (EarnedBadge & { badge: Badge })[]
}

export interface SubmissionWithRelations extends Submission {
  user: User
  activity: Activity
  reviewer?: User | null
  attachments_rel?: SubmissionAttachment[]
}

export interface LeaderboardEntry extends User {
  earned_badges: (EarnedBadge & { badge: Badge })[]
  _sum: { points: number }
}

// User operations
export async function findUserById(id: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { id },
  })
}

export async function findUserByHandle(handle: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { handle },
  })
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { email },
  })
}

export async function createUser(data: {
  id: string
  handle: string
  name: string
  email: string
  role?: Role
  school?: string | null
  cohort?: string | null
  avatar_url?: string | null
  kajabi_contact_id?: string | null
}): Promise<User> {
  return await prisma.user.create({
    data: {
      id: data.id,
      handle: data.handle,
      name: data.name,
      email: data.email,
      role: data.role || 'PARTICIPANT',
      ...(data.school !== undefined ? { school: data.school } : {}),
      ...(data.cohort !== undefined ? { cohort: data.cohort } : {}),
      ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
      ...(data.kajabi_contact_id !== undefined
        ? { kajabi_contact_id: data.kajabi_contact_id }
        : {}),
    },
  })
}

export async function updateUser(
  id: string,
  data: Partial<User>,
): Promise<User> {
  return await prisma.user.update({
    where: { id },
    data,
  })
}

export async function findAllUsers(): Promise<User[]> {
  return await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
  })
}

// Activity operations
export async function findAllActivities(): Promise<Activity[]> {
  return await prisma.activity.findMany({
    orderBy: { code: 'asc' },
  })
}

export async function findActivityByCode(
  code: string,
): Promise<Activity | null> {
  return await prisma.activity.findUnique({
    where: { code },
  })
}

// Submission operations
export async function findSubmissionById(
  id: string,
): Promise<SubmissionWithRelations | null> {
  return await prisma.submission.findUnique({
    where: { id },
    include: {
      user: true,
      activity: true,
      reviewer: true,
      attachments_rel: true,
    },
  })
}

export async function findSubmissionsByUserAndActivity(
  userId: string,
  activityCode: string,
  statusFilter?: SubmissionStatus[],
): Promise<Submission[]> {
  return await prisma.submission.findMany({
    where: {
      user_id: userId,
      activity_code: activityCode,
      ...(statusFilter && { status: { in: statusFilter } }),
    },
    orderBy: { created_at: 'desc' },
  })
}

export async function countSubmissionsByUserAndActivity(
  userId: string,
  activityCode: string,
  dateFilter?: { gte?: Date },
): Promise<number> {
  return await prisma.submission.count({
    where: {
      user_id: userId,
      activity_code: activityCode,
      ...(dateFilter && { created_at: dateFilter }),
    },
  })
}

export async function findSubmissionsWithPagination(
  whereClause: Prisma.SubmissionWhereInput,
  limit: number,
  offset: number,
): Promise<{
  submissions: (Submission & {
    activity: Activity
    attachments_rel: SubmissionAttachment[]
  })[]
  totalCount: number
}> {
  const [submissions, totalCount] = await Promise.all([
    prisma.submission.findMany({
      where: whereClause,
      include: {
        activity: true,
        attachments_rel: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.submission.count({ where: whereClause }),
  ])

  return { submissions, totalCount }
}

export async function findSubmissionsWithFilters(
  params: Prisma.SubmissionFindManyArgs
): Promise<
  (Submission & {
    user?: User
    activity?: Activity
    attachments_rel?: SubmissionAttachment[]
  })[]
> {
  return await prisma.submission.findMany(params)
}

export async function countSubmissionsWithFilters(where: Prisma.SubmissionWhereInput): Promise<number> {
  return await prisma.submission.count({ where })
}

export async function findSubmissionsByIds(
  ids: string[],
): Promise<(Submission & { activity: Activity })[]> {
  return await prisma.submission.findMany({
    where: { id: { in: ids } },
    include: { activity: true },
  })
}

export async function findSubmissionsByUserId(
  userId: string,
): Promise<(Submission & { activity: Activity })[]> {
  return await prisma.submission.findMany({
    where: { user_id: userId },
    include: { activity: true },
    orderBy: { created_at: 'desc' },
  })
}

export async function findSubmissionsByStatus(
  status: SubmissionStatus,
): Promise<SubmissionWithRelations[]> {
  return await prisma.submission.findMany({
    where: { status },
    include: {
      user: true,
      activity: true,
      reviewer: true,
      attachments_rel: true,
    },
    orderBy: { created_at: 'desc' },
  })
}

export async function createSubmission(data: {
  user_id: string
  activity_code: string
  status?: SubmissionStatus
  visibility?: Visibility
  payload: Prisma.InputJsonValue
  reviewer_id?: string | null
  review_note?: string | null
}): Promise<Submission> {
  return await prisma.submission.create({
    data: {
      user_id: data.user_id,
      activity_code: data.activity_code,
      status: data.status || 'PENDING',
      visibility: data.visibility || 'PRIVATE',
      payload: data.payload,
      reviewer_id: data.reviewer_id ?? null,
      review_note: data.review_note ?? null,
    },
  })
}

export async function updateSubmission(
  id: string,
  data: {
    status?: SubmissionStatus
    reviewer_id?: string | null
    review_note?: string | null
    visibility?: Visibility
    payload?: Prisma.InputJsonValue
  },
): Promise<Submission> {
  const updateData: Prisma.SubmissionUncheckedUpdateInput = {
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.reviewer_id !== undefined
      ? { reviewer_id: data.reviewer_id ?? null }
      : {}),
    ...(data.review_note !== undefined
      ? { review_note: data.review_note ?? null }
      : {}),
    ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
    ...(data.payload !== undefined ? { payload: data.payload } : {}),
  }
  return await prisma.submission.update({ where: { id }, data: updateData })
}

export async function findPublicSubmissions(): Promise<
  (Submission & {
    user: User
    activity: Activity
  })[]
> {
  return await prisma.submission.findMany({
    where: {
      visibility: 'PUBLIC',
      status: 'APPROVED',
    },
    include: {
      user: true,
      activity: true,
    },
    orderBy: { created_at: 'desc' },
  })
}

// Badge operations
export async function findAllBadges(): Promise<Badge[]> {
  return await prisma.badge.findMany({
    orderBy: { code: 'asc' },
  })
}

export async function findEarnedBadgesByUserId(
  userId: string,
): Promise<(EarnedBadge & { badge: Badge })[]> {
  return await prisma.earnedBadge.findMany({
    where: { user_id: userId },
    include: { badge: true },
    orderBy: { earned_at: 'desc' },
  })
}

export async function findEarnedBadgesByUserIds(
  userIds: string[],
): Promise<(EarnedBadge & { badge: Badge })[]> {
  return await prisma.earnedBadge.findMany({
    where: { user_id: { in: userIds } },
    include: { badge: true },
    orderBy: { earned_at: 'desc' },
  })
}

export async function createEarnedBadge(data: {
  user_id: string
  badge_code: string
}): Promise<EarnedBadge> {
  return await prisma.earnedBadge.create({
    data: {
      user_id: data.user_id,
      badge_code: data.badge_code,
    },
  })
}

// Points ledger operations
export async function findPointsByUserId(
  userId: string,
): Promise<PointsLedger[]> {
  return await prisma.pointsLedger.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  })
}

export async function createPointsEntry(data: {
  user_id: string
  activity_code: string
  delta_points: number
  source: LedgerSource
  external_event_id?: string | null
}): Promise<PointsLedger> {
  return await prisma.pointsLedger.create({
    data: {
      user_id: data.user_id,
      activity_code: data.activity_code,
      delta_points: data.delta_points,
      source: data.source,
      event_time: new Date(),
      external_event_id: data.external_event_id ?? null,
    },
  })
}

export async function getTotalPointsByUserId(userId: string): Promise<number> {
  const result = await prisma.pointsLedger.aggregate({
    where: { user_id: userId },
    _sum: { delta_points: true },
  })
  return result._sum.delta_points || 0
}

// Leaderboard operations
export async function getLeaderboardData(
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const result = await prisma.user.findMany({
    include: {
      earned_badges: {
        include: { badge: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  })

  // Transform to include aggregated points
  const leaderboard: LeaderboardEntry[] = []
  for (const user of result) {
    const totalPoints = await getTotalPointsByUserId(user.id)
    leaderboard.push({
      ...user,
      _sum: { points: totalPoints },
    })
  }

  return leaderboard
}

export async function get30DayLeaderboardData(
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const result = await prisma.user.findMany({
    include: {
      earned_badges: {
        include: { badge: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  })

  // Calculate 30-day points for each user
  const leaderboard: LeaderboardEntry[] = []
  for (const user of result) {
    const recentPoints = await prisma.pointsLedger.aggregate({
      where: {
        user_id: user.id,
        created_at: { gte: thirtyDaysAgo },
      },
      _sum: { delta_points: true },
    })

    leaderboard.push({
      ...user,
      _sum: { points: recentPoints._sum.delta_points || 0 },
    })
  }

  // Sort by 30-day points
  return leaderboard.sort((a, b) => b._sum.points - a._sum.points)
}

// Profile operations
export async function getPublicProfileByHandle(
  handle: string,
): Promise<UserWithRelations | null> {
  return await prisma.user.findUnique({
    where: { handle },
    include: {
      submissions: {
        where: {
          visibility: 'PUBLIC',
          status: 'APPROVED',
        },
        include: { activity: true },
        orderBy: { created_at: 'desc' },
      },
      earned_badges: {
        include: { badge: true },
        orderBy: { earned_at: 'desc' },
      },
    },
  })
}

// Analytics operations
export async function getPlatformStats() {
  const [totalEducators, totalSubmissions, totalApprovedSubmissions] =
    await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'APPROVED' } }),
    ])

  const totalPoints = await prisma.pointsLedger.aggregate({
    _sum: { delta_points: true },
  })

  return {
    totalEducators,
    totalSubmissions,
    totalApprovedSubmissions,
    totalPoints: totalPoints._sum.delta_points || 0,
  }
}

export async function getStageMetrics() {
  const activities = await findAllActivities()
  const metrics: Record<string, { total: number; approved: number; pending: number; rejected: number }> = {}

  for (const activity of activities) {
    const [total, approved, pending, rejected] = await Promise.all([
      prisma.submission.count({ where: { activity_code: activity.code } }),
      prisma.submission.count({
        where: { activity_code: activity.code, status: 'APPROVED' },
      }),
      prisma.submission.count({
        where: { activity_code: activity.code, status: 'PENDING' },
      }),
      prisma.submission.count({
        where: { activity_code: activity.code, status: 'REJECTED' },
      }),
    ])

    metrics[activity.code.toLowerCase()] = {
      total,
      approved,
      pending,
      rejected,
    }
  }

  return metrics
}

// Kajabi integration operations
export async function createKajabiEvent(data: {
  id: string
  payload: Prisma.InputJsonValue
  user_match?: string | null
  processed_at?: Date | null
}): Promise<KajabiEvent> {
  return await prisma.kajabiEvent.create({
    data: {
      id: data.id,
      payload: data.payload,
      user_match: data.user_match ?? null,
      processed_at: data.processed_at ?? null,
    },
  })
}

export async function findKajabiEventByExternalId(
  externalId: string,
): Promise<KajabiEvent | null> {
  return await prisma.kajabiEvent.findUnique({
    where: { id: externalId },
  })
}

export async function findKajabiEvents(
  limit = 50,
): Promise<KajabiEvent[]> {
  return await prisma.kajabiEvent.findMany({
    orderBy: { received_at: 'desc' },
    take: limit,
  })
}

export async function getKajabiEventStats(): Promise<{
  total_events: number
  processed_events: number
  matched_users: number
  unmatched_events: number
}> {
  const stats = await prisma.kajabiEvent.aggregate({
    _count: {
      id: true,
      processed_at: true,
      user_match: true,
    },
  })

  return {
    total_events: stats._count.id,
    processed_events: stats._count.processed_at,
    matched_users: stats._count.user_match,
    unmatched_events: stats._count.id - stats._count.user_match,
  }
}

export async function getKajabiPointsAwarded(): Promise<number> {
  const pointsResult = await prisma.pointsLedger.aggregate({
    where: {
      external_source: 'kajabi',
    },
    _sum: {
      delta_points: true,
    },
  })

  return pointsResult._sum.delta_points || 0
}

// Audit log operations
export async function createAuditLogEntry(data: {
  actor_id: string
  action: string
  target_id?: string | null
  meta?: Prisma.InputJsonValue
}): Promise<AuditLog> {
  return await prisma.auditLog.create({
    data: {
      actor_id: data.actor_id,
      action: data.action,
      target_id: data.target_id ?? null,
      meta: data.meta ?? Prisma.JsonNull,
    },
  })
}

export async function findAuditLogEntries(
  limit = 50,
): Promise<AuditLog[]> {
  return await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
  })
}

// Attachment operations
export async function createSubmissionAttachment(data: {
  submission_id: string
  path: string
  hash?: string | null
}): Promise<SubmissionAttachment> {
  return await prisma.submissionAttachment.create({
    data: {
      submission_id: data.submission_id,
      path: data.path,
      hash: data.hash ?? null,
    },
  })
}

export async function findAttachmentsBySubmissionId(
  submissionId: string,
): Promise<SubmissionAttachment[]> {
  return await prisma.submissionAttachment.findMany({
    where: { submission_id: submissionId },
    orderBy: { created_at: 'asc' },
  })
}

// =============================================================================
// TRANSACTION-AWARE OPERATIONS - For complex multi-table operations
// =============================================================================

/**
 * Create submission with points and audit trail in a single transaction
 * This is the preferred way to create submissions to ensure data consistency
 */
export async function createSubmissionWithTransaction(data: {
  submission: {
    user_id: string
    activity_code: string
    status?: SubmissionStatus
    visibility?: Visibility
    payload: Prisma.InputJsonValue
    reviewer_id?: string | null
    review_note?: string | null
  }
  points?: {
    delta_points: number
    source: LedgerSource
    external_event_id?: string | null
  }
  audit?: {
    actor_id: string
    action: string
    meta?: Prisma.InputJsonValue
  }
  attachments?: Array<{
    path: string
    hash?: string | null
  }>
}): Promise<{
  submission: Submission
  pointsEntry?: PointsLedger
  auditEntry?: AuditLog
  attachments?: SubmissionAttachment[]
}> {
  return await runTransaction(async (tx) => {
    // Create submission
    const submission = await tx.submission.create({
      data: {
        user_id: data.submission.user_id,
        activity_code: data.submission.activity_code,
        status: data.submission.status || 'PENDING',
        visibility: data.submission.visibility || 'PRIVATE',
        payload: data.submission.payload,
        reviewer_id: data.submission.reviewer_id ?? null,
        review_note: data.submission.review_note ?? null,
      },
    })

    // Create points entry if provided
    let pointsEntry: PointsLedger | undefined
    if (data.points) {
      pointsEntry = await tx.pointsLedger.create({
        data: {
          user_id: data.submission.user_id,
          activity_code: data.submission.activity_code,
          delta_points: data.points.delta_points,
          source: data.points.source,
          event_time: new Date(),
          external_event_id: data.points.external_event_id ?? null,
        },
      })
    }

    // Create audit entry if provided
    let auditEntry: AuditLog | undefined
    if (data.audit) {
      auditEntry = await tx.auditLog.create({
        data: {
          actor_id: data.audit.actor_id,
          action: data.audit.action,
          target_id: submission.id,
          meta: data.audit.meta ?? Prisma.JsonNull,
        },
      })
    }

    // Create attachments if provided
    let attachments: SubmissionAttachment[] | undefined
    if (data.attachments && data.attachments.length > 0) {
      const attachmentPromises = data.attachments.map((attachment) =>
        tx.submissionAttachment.create({
          data: {
            submission_id: submission.id,
            path: attachment.path,
            hash: attachment.hash ?? null,
          },
        }),
      )
      attachments = await Promise.all(attachmentPromises)
    }

    return {
      submission,
      ...(pointsEntry ? { pointsEntry } : {}),
      ...(auditEntry ? { auditEntry } : {}),
      ...(attachments ? { attachments } : {}),
    }
  })
}

/**
 * Update submission status with points and audit trail in a single transaction
 * This is used for approval/rejection workflows
 */
export async function updateSubmissionStatusWithTransaction(data: {
  submissionId: string
  updates: {
    status: SubmissionStatus
    reviewer_id: string
    review_note?: string
    visibility?: Visibility
  }
  points?: {
    delta_points: number
    source: LedgerSource
    external_event_id?: string | null
  }
  audit: {
    actor_id: string
    action: string
    meta?: Prisma.InputJsonValue
  }
}): Promise<{
  submission: Submission
  pointsEntry?: PointsLedger
  auditEntry: AuditLog
}> {
  return await runTransaction(async (tx) => {
    // Get the submission first to ensure it exists and get user_id
    const existingSubmission = await tx.submission.findUnique({
      where: { id: data.submissionId },
    })

    if (!existingSubmission) {
      throw new Error(`Submission ${data.submissionId} not found`)
    }

    // Update submission
    const submission = await tx.submission.update({
      where: { id: data.submissionId },
      data: data.updates,
    })

    // Create points entry if provided
    let pointsEntry: PointsLedger | undefined
    if (data.points) {
      pointsEntry = await tx.pointsLedger.create({
        data: {
          user_id: existingSubmission.user_id,
          activity_code: existingSubmission.activity_code,
          delta_points: data.points.delta_points,
          source: data.points.source,
          event_time: new Date(),
          external_event_id: data.points.external_event_id ?? null,
        },
      })
    }

    // Create audit entry
    const auditEntry = await tx.auditLog.create({
      data: {
        actor_id: data.audit.actor_id,
        action: data.audit.action,
        target_id: submission.id,
        meta: data.audit.meta ?? Prisma.JsonNull,
      },
    })

    return {
      submission,
      ...(pointsEntry ? { pointsEntry } : {}),
      auditEntry,
    }
  })
}

/**
 * Bulk update submissions with audit trail in a single transaction
 * Used for bulk approval/rejection operations
 */
export async function bulkUpdateSubmissionsWithTransaction(data: {
  submissionIds: string[]
  updates: {
    status: SubmissionStatus
    reviewer_id: string
    review_note?: string
  }
  pointsPerSubmission?: {
    delta_points: number
    source: LedgerSource
  }
  audit: {
    actor_id: string
    action: string
    meta?: Prisma.InputJsonValue
  }
}): Promise<{
  submissions: Submission[]
  pointsEntries: PointsLedger[]
  auditEntries: AuditLog[]
}> {
  return await runTransaction(async (tx) => {
    // Get existing submissions to validate and get user_ids/activity_codes
    const existingSubmissions = await tx.submission.findMany({
      where: { id: { in: data.submissionIds } },
    })

    if (existingSubmissions.length !== data.submissionIds.length) {
      const found = existingSubmissions.map((s) => s.id)
      const missing = data.submissionIds.filter((id) => !found.includes(id))
      throw new Error(`Submissions not found: ${missing.join(', ')}`)
    }

    // Update all submissions
    const updatePromises = data.submissionIds.map((id) =>
      tx.submission.update({
        where: { id },
        data: data.updates,
      }),
    )
    const submissions = await Promise.all(updatePromises)

    // Create points entries if provided
    let pointsEntries: PointsLedger[] = []
    if (data.pointsPerSubmission) {
      const pointsData = data.pointsPerSubmission
      const pointsPromises = existingSubmissions.map((submission) =>
        tx.pointsLedger.create({
          data: {
            user_id: submission.user_id,
            activity_code: submission.activity_code,
            delta_points: pointsData.delta_points,
            source: pointsData.source,
            event_time: new Date(),
          },
        }),
      )
      pointsEntries = await Promise.all(pointsPromises)
    }

    // Create audit entries for each submission
    const auditPromises = submissions.map((submission) =>
      tx.auditLog.create({
        data: {
          actor_id: data.audit.actor_id,
          action: data.audit.action,
          target_id: submission.id,
          meta: data.audit.meta ?? Prisma.JsonNull,
        },
      }),
    )
    const auditEntries = await Promise.all(auditPromises)

    return {
      submissions,
      pointsEntries,
      auditEntries,
    }
  })
}

/**
 * Award badge with audit trail in a single transaction
 */
export async function awardBadgeWithTransaction(data: {
  user_id: string
  badge_code: string
  audit: {
    actor_id: string
    action: string
    meta?: Prisma.InputJsonValue
  }
}): Promise<{
  badge: EarnedBadge
  auditEntry: AuditLog
}> {
  return await runTransaction(async (tx) => {
    // Check if badge already exists
    const existingBadge = await tx.earnedBadge.findFirst({
      where: {
        user_id: data.user_id,
        badge_code: data.badge_code,
      },
    })

    if (existingBadge) {
      throw new Error(
        `Badge ${data.badge_code} already awarded to user ${data.user_id}`,
      )
    }

    // Create badge
    const badge = await tx.earnedBadge.create({
      data: {
        user_id: data.user_id,
        badge_code: data.badge_code,
      },
    })

    // Create audit entry
    const auditEntry = await tx.auditLog.create({
      data: {
        actor_id: data.audit.actor_id,
        action: data.audit.action,
        target_id: badge.id,
        meta: data.audit.meta ?? Prisma.JsonNull,
      },
    })

    return {
      badge,
      auditEntry,
    }
  })
}

// Export all Prisma types for use in services
export type {
  User,
  Submission,
  Activity,
  Badge,
  EarnedBadge,
  PointsLedger,
  SubmissionAttachment,
  AuditLog,
  KajabiEvent,
  SubmissionStatus,
  Visibility,
  Role,
} from '@prisma/client'
