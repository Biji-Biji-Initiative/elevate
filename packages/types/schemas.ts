import { z } from 'zod'

export const LearnSchema = z.object({
  provider: z.enum(['SPL', 'ILS']),
  course: z.string().min(2),
  completedAt: z.string(),
  certificateFile: z.string().optional(), // Storage path after upload
})

export const ExploreSchema = z.object({
  reflection: z.string().min(150),
  classDate: z.string(),
  school: z.string().optional(),
  evidenceFiles: z.array(z.string()).optional(), // Array of storage paths after upload
})

export const AmplifySchema = z.object({
  peersTrained: z.coerce.number().int().min(0).max(50),
  studentsTrained: z.coerce.number().int().min(0).max(200),
  attendanceProofFiles: z.array(z.string()).optional(), // Array of storage paths after upload
})

export const PresentSchema = z.object({
  linkedinUrl: z.string().url(),
  screenshotFile: z.string().optional(), // Storage path after upload
  caption: z.string().min(10),
})

export const ShineSchema = z.object({
  ideaTitle: z.string().min(4),
  ideaSummary: z.string().min(50),
  attachment: z.array(z.string()).optional(), // Array of storage paths after upload
})

export type LearnInput = z.infer<typeof LearnSchema>
export type ExploreInput = z.infer<typeof ExploreSchema>
export type AmplifyInput = z.infer<typeof AmplifySchema>
export type PresentInput = z.infer<typeof PresentSchema>
export type ShineInput = z.infer<typeof ShineSchema>
