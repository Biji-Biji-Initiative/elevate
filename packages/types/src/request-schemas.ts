import { z } from 'zod'

import { ACTIVITY_CODES, VISIBILITY_OPTIONS } from './domain-constants'

// Shared API request schema for creating a submission
// Accepts a generic payload object; activity-specific validation
// is handled by sanitizers and payload transformers.
export const SubmissionCreateRequestSchema = z.object({
  activityCode: z.enum(ACTIVITY_CODES),
  payload: z.record(z.string(), z.unknown()),
  attachments: z.array(z.string()).optional(),
  visibility: z.enum(VISIBILITY_OPTIONS).optional(),
})

export type SubmissionCreateRequest = z.infer<typeof SubmissionCreateRequestSchema>
