import { z } from 'zod'

import { SubmissionPayloadSchema, type SubmissionPayload } from './submission-payloads'

import type { Role, SubmissionStatus, Visibility } from './common'

// UI-specific type guards
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isArray<T>(value: unknown, itemCheck?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false
  if (!itemCheck) return true
  return value.every(itemCheck)
}

// Safe property access helper
export function safeGet<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K
): T[K] | undefined {
  return obj && isObject(obj) && key in obj ? obj[key] : undefined
}

// User types for UI components
export interface SafeUser {
  id: string
  name: string
  handle: string
  email?: string
  school?: string | null
  cohort?: string | null
  avatar_url?: string | null
  role?: Role
}

export const SafeUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  email: z.string().email().optional(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  role: z.enum(['SUPERADMIN','ADMIN','REVIEWER','PARTICIPANT']).optional(),
})

// Submission types with proper typing
export interface SafeSubmission {
  id: string
  user: SafeUser
  activity: {
    code: string
    name: string
  }
  status: SubmissionStatus
  visibility: Visibility
  payload: SubmissionPayload
  attachments: string[]
  reviewer_id?: string
  review_note?: string
  created_at: string
  updated_at: string
}

// Badge types
export interface SafeBadge {
  code: string
  name: string
  description?: string
  icon_url?: string | null
  earned_at?: string
}

export const SafeBadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon_url: z.string().nullable().optional(),
  earned_at: z.string().optional(),
})

// Leaderboard entry types

// Form types with better validation
export const FormFieldSchema = z.object({
  label: z.string().min(1),
  required: z.boolean().optional(),
  description: z.string().optional(),
  error: z.string().optional()
})

export type FormFieldProps = z.infer<typeof FormFieldSchema> & {
  children: unknown // React.ReactNode when used in React components
  className?: string
}

// Select component types
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SafeSelectProps {
  options: SelectOption[]
  value?: string | string[]
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  className?: string
}

// Status types with type guards
export const STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED', 'PUBLIC', 'PRIVATE'] as const
export type StatusValue = typeof STATUS_VALUES[number]

export function isStatusValue(value: unknown): value is StatusValue {
  return isString(value) && STATUS_VALUES.includes(value as StatusValue)
}

// Dashboard data types
export interface DashboardStats {
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  completedStages: number
}

export const DashboardStatsSchema = z.object({
  totalSubmissions: z.number(),
  approvedSubmissions: z.number(),
  pendingSubmissions: z.number(),
  completedStages: z.number(),
})

export interface ProgressStage {
  activityCode: string
  activityName: string
  defaultPoints: number
  pointsEarned: number
  submissionCounts: {
    total: number
    approved: number
    pending: number
    rejected: number
  }
  latestSubmission: SubmissionPayload | null
  hasCompleted: boolean
}

export const ProgressStageSchema = z.object({
  activityCode: z.string(),
  activityName: z.string(),
  defaultPoints: z.number(),
  pointsEarned: z.number(),
  submissionCounts: z.object({
    total: z.number(),
    approved: z.number(),
    pending: z.number(),
    rejected: z.number(),
  }),
  latestSubmission: SubmissionPayloadSchema.nullable(),
  hasCompleted: z.boolean(),
})

export interface SafeDashboardData {
  user: SafeUser
  points: {
    total: number
    breakdown: Record<string, number>
  }
  progress: ProgressStage[]
  badges: SafeBadge[]
  recentActivity: {
    id: string
    activityCode: string
    activityName: string
    status: string
    created_at: string
    updated_at: string
  }[]
  stats: DashboardStats
}

export const SafeDashboardDataSchema = z.object({
  user: SafeUserSchema,
  points: z.object({
    total: z.number(),
    breakdown: z.record(z.number()),
  }),
  progress: z.array(ProgressStageSchema),
  badges: z.array(SafeBadgeSchema),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      activityCode: z.string(),
      activityName: z.string(),
      status: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
    })
  ),
  stats: DashboardStatsSchema,
})

// Pagination types
export interface PaginationConfig {
  page: number
  limit: number
  total: number
  pages?: number
  onPageChange: (page: number) => void
}

// Filters and sorting
export interface TableFilters {
  status?: string
  activity?: string
  search?: string
  cohort?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// UI API response type (different name to avoid conflict with common.ts)
export type UIApiResponse<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, unknown> }

// Event handler types with better typing (without React dependencies)
export interface SafeEventHandlers {
  onClick?: (event: Event) => void
  onChange?: (value: string) => void
  onSubmit?: (event: Event) => void
  onSelection?: (selectedIds: Set<string>) => void
}

// Component size and variant types
export type ComponentSize = 'sm' | 'md' | 'lg'
export type ComponentVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive'

export function isComponentSize(value: unknown): value is ComponentSize {
  return isString(value) && ['sm', 'md', 'lg'].includes(value)
}

export function isComponentVariant(value: unknown): value is ComponentVariant {
  return isString(value) && ['default', 'primary', 'secondary', 'ghost', 'destructive'].includes(value)
}

// Validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateHandle(handle: string): boolean {
  const handleRegex = /^[a-zA-Z0-9_-]{3,30}$/
  return handleRegex.test(handle)
}

export function sanitizeString(input: unknown): string {
  if (!isString(input)) return ''
  return input.trim()
}

export function sanitizeNumber(input: unknown): number | null {
  if (isNumber(input)) return input
  if (isString(input)) {
    const parsed = parseFloat(input)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}
