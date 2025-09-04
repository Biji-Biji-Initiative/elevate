import { z } from 'zod'

import { LearnSchema, ExploreSchema, AmplifySchema, PresentSchema, ShineSchema } from './schemas'

// Discriminated union for submission payloads by activity_code
export const SubmissionPayloadSchema = z.discriminatedUnion('activityCode', [
  z.object({
    activityCode: z.literal('LEARN'),
    data: LearnSchema,
  }),
  z.object({
    activityCode: z.literal('EXPLORE'),
    data: ExploreSchema,
  }),
  z.object({
    activityCode: z.literal('AMPLIFY'),
    data: AmplifySchema,
  }),
  z.object({
    activityCode: z.literal('PRESENT'),
    data: PresentSchema,
  }),
  z.object({
    activityCode: z.literal('SHINE'),
    data: ShineSchema,
  }),
])

// Individual payload schemas for specific activities
export const LearnPayloadSchema = z.object({
  activityCode: z.literal('LEARN'),
  data: LearnSchema,
})

export const ExplorePayloadSchema = z.object({
  activityCode: z.literal('EXPLORE'),
  data: ExploreSchema,
})

export const AmplifyPayloadSchema = z.object({
  activityCode: z.literal('AMPLIFY'),
  data: AmplifySchema,
})

export const PresentPayloadSchema = z.object({
  activityCode: z.literal('PRESENT'),
  data: PresentSchema,
})

export const ShinePayloadSchema = z.object({
  activityCode: z.literal('SHINE'),
  data: ShineSchema,
})

// Inferred types
export type SubmissionPayload = z.infer<typeof SubmissionPayloadSchema>
export type LearnPayload = z.infer<typeof LearnPayloadSchema>
export type ExplorePayload = z.infer<typeof ExplorePayloadSchema>
export type AmplifyPayload = z.infer<typeof AmplifyPayloadSchema>
export type PresentPayload = z.infer<typeof PresentPayloadSchema>
export type ShinePayload = z.infer<typeof ShinePayloadSchema>

// DB-facing input shapes (snake_case), used by API transformers

// Helper function to parse submission payload safely
export function parseSubmissionPayload(payload: unknown): SubmissionPayload | null {
  const result = SubmissionPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

// Activity-specific parser functions
export function parseLearnPayload(payload: unknown): LearnPayload | null {
  const result = LearnPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseExplorePayload(payload: unknown): ExplorePayload | null {
  const result = ExplorePayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseAmplifyPayload(payload: unknown): AmplifyPayload | null {
  const result = AmplifyPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parsePresentPayload(payload: unknown): PresentPayload | null {
  const result = PresentPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseShinePayload(payload: unknown): ShinePayload | null {
  const result = ShinePayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}
