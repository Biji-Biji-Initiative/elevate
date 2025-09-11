import { z } from 'zod'

import { 
  HandleSchema,
  ActivityFilterSchema,
  StatusFilterSchema,
  RoleFilterSchema
} from './domain-constants'

export const LeaderboardQuerySchema = z.object({
  period: z.enum(['all', '30d']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(200).trim().optional().default(''),
})

export const MetricsQuerySchema = z.object({
  stage: z.enum(['learn', 'explore', 'amplify', 'present', 'shine']),
})

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>

export const HandleParamSchema = z.object({
  handle: HandleSchema
})

export type HandleParam = z.infer<typeof HandleParamSchema>

// Admin: Submissions list query
export const AdminSubmissionsQuerySchema = z.object({
  status: StatusFilterSchema.default('PENDING'),
  activity: ActivityFilterSchema.default('ALL'),
  userId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['created_at', 'updated_at', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type AdminSubmissionsQuery = z.infer<typeof AdminSubmissionsQuerySchema>

// Admin: Users list query
export const AdminUsersQuerySchema = z.object({
  search: z.string().max(200).trim().optional().default(''),
  role: RoleFilterSchema.default('ALL'),
  userType: z.enum(['ALL', 'EDUCATOR', 'STUDENT']).default('ALL'),
  kajabi: z.enum(['ALL', 'LINKED', 'UNLINKED']).default('ALL'),
  cohort: z.string().max(100).trim().optional().default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['created_at', 'name', 'email']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>
