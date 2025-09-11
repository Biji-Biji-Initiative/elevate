// Pure mappers for Prisma rows -> Admin DTOs
//
// These helpers centralize all translation from database-shaped rows
// to the Admin app's public DTOs. Each mapper:
// - Accepts a minimal structural type (keeps coupling low)
// - Normalizes dates to ISO strings
// - Applies safe defaults for optional fields
// - Performs a single Zod validation at the boundary where appropriate
// The result is consistent, intention‑revealing DTO construction with
// great DX and strong runtime guarantees.
import { parseActivityCode, parseSubmissionStatus } from '@elevate/types'
import { AdminSubmissionSchema, AdminBadgeSchema, AdminUserSchema, type AdminSubmission, type AdminBadge, type AdminUser } from '@elevate/types/admin-api-types'

// Define minimal structural types to avoid direct coupling to @prisma/client
type UserMini = { id: string; name: string | null; email: string | null; handle: string | null; school: string | null; cohort: string | null }
type ActivityMini = { code: string; name: string | null; default_points: number | null }
type SubmissionAttachmentMini = { id: string; submission_id: string; path: string; created_at?: Date }

/** A minimal submission row shape used by toAdminSubmission. */
export type SubmissionRow = {
  id: string
  created_at: Date
  updated_at: Date | null
  status: string
  visibility: string
  review_note: string | null
  points_awarded?: number | null
  payload: unknown
  activity_code: string
  attachments_rel: SubmissionAttachmentMini[]
  user: UserMini | null
  activity: ActivityMini | null
}

/** Map a Submission row into the AdminSubmission DTO (validates via Zod). */
export function toAdminSubmission(row: SubmissionRow): AdminSubmission {
  const dto = {
    id: row.id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
    status: row.status,
    visibility: row.visibility,
    review_note: row.review_note ?? null,
    points_awarded: row.points_awarded ?? undefined,
    payload: (row.payload ?? {}) as unknown,
    attachmentCount: row.attachments_rel?.length ?? 0,
    user: {
      id: row.user?.id ?? '',
      name: row.user?.name ?? '',
      handle: row.user?.handle ?? '',
      email: row.user?.email ?? undefined,
      school: row.user?.school ?? null,
      cohort: row.user?.cohort ?? null,
    },
    activity: {
      code: row.activity?.code ?? row.activity_code,
      name: row.activity?.name ?? row.activity_code,
      default_points: row.activity?.default_points ?? undefined,
    },
    reviewer: undefined,
    reviewed_at: undefined,
  }
  return AdminSubmissionSchema.parse(dto)
}

/** A minimal badge row shape used by toAdminBadge. */
export type BadgeRow = {
  code: string
  name: string
  description: string
  criteria: unknown
  icon_url: string | null
  _count?: { earned_badges: number }
  earned_badges?: Array<{ id: string; earned_at: Date; user: { id: string; name: string | null; handle: string | null } | null }>
}

/** Map a Badge row (and optional earned stats) into AdminBadge DTO. */
export function toAdminBadge(row: BadgeRow, opts: { includeStats?: boolean } = {}): AdminBadge {
  const { includeStats = false } = opts
  const dto: unknown = {
    code: row.code,
    name: row.name,
    description: row.description,
    criteria: (row.criteria ?? {}) as unknown,
    icon_url: row.icon_url ?? undefined,
    ...(includeStats
      ? {
          _count: { earned_badges: row._count?.earned_badges ?? 0 },
          earned_badges: (row.earned_badges ?? []).map((eb: { id: string; earned_at: Date; user: { id: string; name: string | null; handle: string | null } | null }) => ({
            id: eb.id,
            user: { id: eb.user?.id ?? '', name: eb.user?.name ?? '', handle: eb.user?.handle ?? '' },
            earned_at: eb.earned_at.toISOString(),
          })),
        }
      : {}),
  }
  return AdminBadgeSchema.parse(dto)
}

/** A minimal user row shape used by toAdminUser. */
export type AdminUserRow = {
  id: string
  handle: string
  name: string | null
  email: string
  avatar_url: string | null
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  user_type: 'EDUCATOR' | 'STUDENT' | null
  user_type_confirmed: boolean | null
  kajabi_contact_id: string | null
  school: string | null
  cohort: string | null
  created_at: Date
  _count: { submissions: number; ledger: number; earned_badges: number }
}

/** Map a user row + computed totals into AdminUser DTO (validates via Zod). */
export function toAdminUser(row: AdminUserRow, totalPoints: number): AdminUser {
  const dto = {
    id: row.id,
    handle: row.handle,
    name: row.name ?? '',
    email: row.email,
    avatar_url: row.avatar_url ?? null,
    role: row.role,
    user_type: row.user_type ?? undefined,
    user_type_confirmed: row.user_type_confirmed ?? undefined,
    kajabi_contact_id: row.kajabi_contact_id ?? undefined,
    school: row.school,
    cohort: row.cohort,
    created_at: row.created_at.toISOString(),
    _count: row._count,
    totalPoints,
  }
  return AdminUserSchema.parse(dto)
}

// Referrals mapping
/** A minimal referral event row used by toReferralRow. */
export type ReferralEventRow = {
  id: string
  event_type: string
  source: string | null
  created_at: Date
  external_event_id: string | null
  referrer: { id: string; name: string | null; email: string | null }
  referee: { id: string; name: string | null; email: string | null; user_type: 'EDUCATOR' | 'STUDENT' }
}

/** Map a referral row with nested referrer/referee into the UI DTO. */
export function toReferralRow(row: ReferralEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    externalEventId: row.external_event_id ?? null,
    referrer: { id: row.referrer.id, name: row.referrer.name ?? '', email: row.referrer.email ?? '' },
    referee: { id: row.referee.id, name: row.referee.name ?? '', email: row.referee.email ?? '', user_type: row.referee.user_type as 'EDUCATOR' | 'STUDENT' },
  }
}

// Kajabi mapping
/** Map a KajabiEvent row into the Admin Kajabi DTO. */
export function toKajabiEvent(row: { id: string; created_at_utc: Date; raw: unknown }) {
  const raw = (row.raw ?? {}) as Record<string, unknown>
  const user_match = typeof raw.user_match === 'string' ? raw.user_match : null
  return {
    id: row.id,
    received_at: row.created_at_utc.toISOString(),
    processed_at: null as string | null,
    user_match,
    payload: (raw as unknown) ?? {},
  }
}

// Analytics recent activity mappers
/** Map a recent submission row for analytics recentActivity. */
export function toRecentSubmission(row: {
  id: string
  activity_code: string
  created_at: Date
  status: string
  user: { name: string | null } | null
}) {
  return {
    id: row.id,
    activity_code: parseActivityCode(row.activity_code) ?? 'LEARN',
    user_name: row.user?.name ?? '',
    created_at: row.created_at.toISOString(),
    status: parseSubmissionStatus(row.status) ?? 'PENDING',
  }
}

/** Map a recent approval row for analytics recentActivity. */
export function toRecentApproval(row: {
  id: string
  activity_code: string
  updated_at: Date | null
  points_awarded: number | null
  reviewer: { name: string | null } | null
  user: { name: string | null } | null
}) {
  return {
    id: row.id,
    activity_code: parseActivityCode(row.activity_code) ?? 'LEARN',
    user_name: row.user?.name ?? '',
    reviewer_name: row.reviewer?.name ?? '',
    approved_at: (row.updated_at ?? new Date()).toISOString(),
    points_awarded: row.points_awarded ?? 0,
  }
}

/** Map a recent user row for analytics recentActivity. */
export function toRecentUser(row: { id: string; name: string | null; created_at: Date; cohort: string | null }) {
  return { id: row.id, name: row.name ?? '', created_at: row.created_at.toISOString(), cohort: row.cohort }
}

// Analytics: reviewer performance + top badges
/** Map reviewer performance aggregates into DTO. */
export function toReviewerPerformance(row: { id: string; name: string; total: number; approved: number; avgReviewTimeHours?: number }) {
  const avg = typeof row.avgReviewTimeHours === 'number' ? row.avgReviewTimeHours : 0
  const approvalRate = row.total ? Math.round((row.approved / row.total) * 100) / 100 : 0
  return { id: row.id, name: row.name, reviewCount: row.total, avgReviewTimeHours: avg, approvalRate }
}

/** Map top badge aggregates into DTO. */
export function toTopBadgeStat(row: { code: string; name: string; earnedCount: number; uniqueEarners?: number }) {
  return { code: row.code, name: row.name, earnedCount: row.earnedCount, uniqueEarners: row.uniqueEarners ?? 0 }
}
