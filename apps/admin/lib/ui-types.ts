import type {
  AdminBadge,
  AdminUser,
  AdminSubmission,
} from '@elevate/types/admin-api-types'

// Badge UI projection
export type BadgeUI = {
  code: string
  name: string
  description: string
  icon_url: string
  criteria: {
    type: 'points' | 'submissions' | 'activities' | 'streak'
    threshold: number
    activity_codes: string[]
    conditions: Record<string, unknown>
  }
  _count?: { earned_badges: number }
}

export function toBadgeUI(badge: AdminBadge): BadgeUI {
  const c = badge.criteria as unknown as BadgeUI['criteria'] | undefined
  const type = (c?.type ?? 'points') as BadgeUI['criteria']['type']
  const threshold = typeof c?.threshold === 'number' ? c.threshold : 0
  const activity_codes = Array.isArray(c?.activity_codes)
    ? (c.activity_codes as string[])
    : []
  const conditions =
    c?.conditions && typeof c.conditions === 'object'
      ? (c.conditions as Record<string, unknown>)
      : {}
  return {
    code: badge.code,
    name: badge.name,
    description: badge.description,
    icon_url: badge.icon_url ?? '',
    criteria: { type, threshold, activity_codes, conditions },
    _count: { earned_badges: badge._count?.earned_badges ?? 0 },
  }
}

// User UI projection
export type UserUI = {
  id: string
  name: string
  handle: string
  email: string
  school: string
  cohort: string
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  totalPoints: number
  _count: { submissions: number; earned_badges: number }
  created_at: string
}

export function toUserUI(u: AdminUser): UserUI {
  return {
    id: u.id,
    name: u.name ?? '',
    handle: u.handle ?? '',
    email: u.email ?? '',
    school: u.school ?? '',
    cohort: u.cohort ?? '',
    role: (u.role ?? 'PARTICIPANT') as UserUI['role'],
    totalPoints: u.totalPoints ?? 0,
    _count: {
      submissions: u._count?.submissions ?? 0,
      earned_badges: u._count?.earned_badges ?? 0,
    },
    created_at: u.created_at,
  }
}

// Submission row UI projection
export type SubmissionRowUI = {
  id: string
  created_at: string
  status: string
  visibility: string
  attachmentCount: number
  user: { name: string; handle: string; school: string }
  activity: { name: string; code: string }
}

export function toSubmissionRowUI(s: AdminSubmission): SubmissionRowUI {
  return {
    id: s.id,
    created_at: s.created_at,
    status: s.status ?? '',
    visibility: s.visibility ?? '',
    attachmentCount: s.attachmentCount ?? 0,
    user: {
      name: s.user?.name ?? '',
      handle: s.user?.handle ?? '',
      school: s.user?.school ?? '',
    },
    activity: {
      name: s.activity?.name ?? '',
      code: s.activity?.code ?? '',
    },
  }
}

