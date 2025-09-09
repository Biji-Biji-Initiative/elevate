import { z } from 'zod'

// Database storage schemas (snake_case) - source of truth
// These schemas validate data as it will be stored in the database
// Following Prisma-first principles where snake_case is the canonical format

export const LearnSchema = z.object({
  provider: z.enum(['SPL', 'ILS']),
  course_name: z.string().min(2),
  certificate_url: z.string().optional(),
  certificate_hash: z.string().optional(), // For duplicate detection
  completed_at: z.string(), // DB storage format: snake_case
})

export const ExploreSchema = z.object({
  reflection: z.string().min(150),
  class_date: z.string(), // DB storage format: snake_case
  school: z.string().optional(),
  evidence_files: z.array(z.string()).optional(), // DB storage format: snake_case
})

export const AmplifySchema = z.object({
  peers_trained: z.number().int().min(0).max(50), // DB storage format: snake_case
  students_trained: z.number().int().min(0).max(200), // DB storage format: snake_case
  attendance_proof_files: z.array(z.string()).optional(), // DB storage format: snake_case
  session_date: z.string(),
  session_start_time: z.string().optional(),
  duration_minutes: z.number().int().min(0).optional(),
  location: z
    .object({
      venue: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  session_title: z.string().optional(),
  co_facilitators: z.array(z.string()).optional(),
  evidence_note: z.string().optional(),
})

export const PresentSchema = z.object({
  linkedin_url: z.string().url(), // DB storage format: snake_case
  screenshot_url: z.string().optional(), // DB storage format: snake_case
  caption: z.string().min(10),
})

export const ShineSchema = z.object({
  idea_title: z.string().min(4), // DB storage format: snake_case
  idea_summary: z.string().min(50), // DB storage format: snake_case
  attachments: z.array(z.string()).optional(), // DB storage format: snake_case
})

export type LearnInput = z.infer<typeof LearnSchema>
export type ExploreInput = z.infer<typeof ExploreSchema>
export type AmplifyInput = z.infer<typeof AmplifySchema>
export type PresentInput = z.infer<typeof PresentSchema>
export type ShineInput = z.infer<typeof ShineSchema>
