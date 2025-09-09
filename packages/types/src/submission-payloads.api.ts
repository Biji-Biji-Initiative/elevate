import { z } from 'zod'

// =============================================================================
// TRANSFORMATION FUNCTIONS - camelCase API → snake_case DB
// =============================================================================

import type {
  LearnInput,
  ExploreInput,
  AmplifyInput,
  PresentInput,
  ShineInput,
} from './schemas'
import type {
  LearnPayload,
  ExplorePayload,
  AmplifyPayload,
  PresentPayload,
  ShinePayload,
} from './submission-payloads'

/**
 * API LAYER SCHEMAS - camelCase for External API Consumption
 *
 * These schemas validate data as received from external APIs (camelCase).
 * They are then transformed to snake_case before database storage.
 *
 * This separation allows us to:
 * 1. Accept camelCase from frontend/external APIs (user-friendly)
 * 2. Store snake_case in database (Prisma/SQL convention)
 * 3. Maintain backward compatibility during migrations
 */

// =============================================================================
// API INPUT SCHEMAS (camelCase) - What we receive from external APIs
// =============================================================================

export const LearnApiSchema = z.object({
  provider: z.enum(['SPL', 'ILS']),
  courseName: z.string().min(2), // API receives: courseName
  certificateUrl: z.string().optional(), // API receives: certificateUrl
  certificateHash: z.string().optional(), // API receives: certificateHash (for duplicate detection)
  completedAt: z.string(), // API receives: completedAt
})

export const ExploreApiSchema = z.object({
  reflection: z.string().min(150),
  classDate: z.string(), // API receives: classDate
  school: z.string().optional(),
  evidenceFiles: z.array(z.string()).optional(), // API receives: evidenceFiles
})

export const AmplifyApiSchema = z.object({
  peersTrained: z.number().int().min(0).max(50), // API receives: peersTrained
  studentsTrained: z.number().int().min(0).max(200), // API receives: studentsTrained
  attendanceProofFiles: z.array(z.string()).optional(), // API receives: attendanceProofFiles
  sessionDate: z.string(),
  sessionStartTime: z.string().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  location: z
    .object({
      venue: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  sessionTitle: z.string().optional(),
  coFacilitators: z.array(z.string()).optional(),
  evidenceNote: z.string().optional(),
})

export const PresentApiSchema = z.object({
  linkedinUrl: z.string().url(), // API receives: linkedinUrl
  screenshotUrl: z.string().optional(), // API receives: screenshotUrl
  caption: z.string().min(10),
})

export const ShineApiSchema = z.object({
  ideaTitle: z.string().min(4), // API receives: ideaTitle
  ideaSummary: z.string().min(50), // API receives: ideaSummary
  attachments: z.array(z.string()).optional(),
})

// =============================================================================
// API PAYLOAD SCHEMAS - Discriminated unions for API consumption
// =============================================================================

export const SubmissionApiPayloadSchema = z.discriminatedUnion('activityCode', [
  z.object({
    activityCode: z.literal('LEARN'),
    data: LearnApiSchema,
  }),
  z.object({
    activityCode: z.literal('EXPLORE'),
    data: ExploreApiSchema,
  }),
  z.object({
    activityCode: z.literal('AMPLIFY'),
    data: AmplifyApiSchema,
  }),
  z.object({
    activityCode: z.literal('PRESENT'),
    data: PresentApiSchema,
  }),
  z.object({
    activityCode: z.literal('SHINE'),
    data: ShineApiSchema,
  }),
])

// Individual API payload schemas
export const LearnApiPayloadSchema = z.object({
  activityCode: z.literal('LEARN'),
  data: LearnApiSchema,
})

export const ExploreApiPayloadSchema = z.object({
  activityCode: z.literal('EXPLORE'),
  data: ExploreApiSchema,
})

export const AmplifyApiPayloadSchema = z.object({
  activityCode: z.literal('AMPLIFY'),
  data: AmplifyApiSchema,
})

export const PresentApiPayloadSchema = z.object({
  activityCode: z.literal('PRESENT'),
  data: PresentApiSchema,
})

export const ShineApiPayloadSchema = z.object({
  activityCode: z.literal('SHINE'),
  data: ShineApiSchema,
})

// =============================================================================
// TYPE DEFINITIONS - Inferred from API schemas
// =============================================================================

export type LearnApiInput = z.infer<typeof LearnApiSchema>
export type ExploreApiInput = z.infer<typeof ExploreApiSchema>
export type AmplifyApiInput = z.infer<typeof AmplifyApiSchema>
export type PresentApiInput = z.infer<typeof PresentApiSchema>
export type ShineApiInput = z.infer<typeof ShineApiSchema>

export type SubmissionApiPayload = z.infer<typeof SubmissionApiPayloadSchema>
export type LearnApiPayload = z.infer<typeof LearnApiPayloadSchema>
export type ExploreApiPayload = z.infer<typeof ExploreApiPayloadSchema>
export type AmplifyApiPayload = z.infer<typeof AmplifyApiPayloadSchema>
export type PresentApiPayload = z.infer<typeof PresentApiPayloadSchema>
export type ShineApiPayload = z.infer<typeof ShineApiPayloadSchema>

/**
 * Transform API camelCase inputs to database snake_case format
 * These functions ensure data flows correctly from API layer to DB layer
 */

export function transformLearnApiToDb(apiInput: LearnApiInput): LearnInput {
  return {
    provider: apiInput.provider,
    course_name: apiInput.courseName, // camelCase → snake_case
    certificate_url: apiInput.certificateUrl, // camelCase → snake_case
    completed_at: apiInput.completedAt, // camelCase → snake_case
  }
}

export function transformExploreApiToDb(
  apiInput: ExploreApiInput,
): ExploreInput {
  return {
    reflection: apiInput.reflection,
    class_date: apiInput.classDate, // camelCase → snake_case
    school: apiInput.school,
    evidence_files: apiInput.evidenceFiles, // camelCase → snake_case
  }
}

export function transformAmplifyApiToDb(
  apiInput: AmplifyApiInput,
): AmplifyInput {
  return {
    peers_trained: apiInput.peersTrained, // camelCase → snake_case
    students_trained: apiInput.studentsTrained, // camelCase → snake_case
    attendance_proof_files: apiInput.attendanceProofFiles, // camelCase → snake_case
    session_date: apiInput.sessionDate,
    session_start_time: apiInput.sessionStartTime,
    duration_minutes: apiInput.durationMinutes,
    location: apiInput.location,
    session_title: apiInput.sessionTitle,
    co_facilitators: apiInput.coFacilitators,
    evidence_note: apiInput.evidenceNote,
  }
}

export function transformPresentApiToDb(
  apiInput: PresentApiInput,
): PresentInput {
  return {
    linkedin_url: apiInput.linkedinUrl, // camelCase → snake_case
    screenshot_url: apiInput.screenshotUrl, // camelCase → snake_case
    caption: apiInput.caption,
  }
}

export function transformShineApiToDb(apiInput: ShineApiInput): ShineInput {
  return {
    idea_title: apiInput.ideaTitle, // camelCase → snake_case
    idea_summary: apiInput.ideaSummary, // camelCase → snake_case
    attachments: apiInput.attachments,
  }
}

/**
 * Main transformation function for submission payloads
 */
export function transformApiPayloadToDb(
  apiPayload: SubmissionApiPayload,
):
  | LearnPayload
  | ExplorePayload
  | AmplifyPayload
  | PresentPayload
  | ShinePayload {
  switch (apiPayload.activityCode) {
    case 'LEARN':
      return {
        activityCode: 'LEARN',
        data: transformLearnApiToDb(apiPayload.data),
      }
    case 'EXPLORE':
      return {
        activityCode: 'EXPLORE',
        data: transformExploreApiToDb(apiPayload.data),
      }
    case 'AMPLIFY':
      return {
        activityCode: 'AMPLIFY',
        data: transformAmplifyApiToDb(apiPayload.data),
      }
    case 'PRESENT':
      return {
        activityCode: 'PRESENT',
        data: transformPresentApiToDb(apiPayload.data),
      }
    case 'SHINE':
      return {
        activityCode: 'SHINE',
        data: transformShineApiToDb(apiPayload.data),
      }
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = apiPayload
      throw new Error('Unknown activity code')
  }
}

// =============================================================================
// REVERSE TRANSFORMATION FUNCTIONS - snake_case DB → camelCase API
// =============================================================================

/**
 * Transform database snake_case to API camelCase format
 * Used when returning data to frontend/external APIs
 */

export function transformLearnDbToApi(dbInput: LearnInput): LearnApiInput {
  return {
    provider: dbInput.provider,
    courseName: dbInput.course_name, // snake_case → camelCase
    certificateUrl: dbInput.certificate_url, // snake_case → camelCase
    completedAt: dbInput.completed_at, // snake_case → camelCase
  }
}

export function transformExploreDbToApi(
  dbInput: ExploreInput,
): ExploreApiInput {
  return {
    reflection: dbInput.reflection,
    classDate: dbInput.class_date, // snake_case → camelCase
    school: dbInput.school,
    evidenceFiles: dbInput.evidence_files, // snake_case → camelCase
  }
}

export function transformAmplifyDbToApi(
  dbInput: AmplifyInput,
): AmplifyApiInput {
  return {
    peersTrained: dbInput.peers_trained, // snake_case → camelCase
    studentsTrained: dbInput.students_trained, // snake_case → camelCase
    attendanceProofFiles: dbInput.attendance_proof_files, // snake_case → camelCase
    sessionDate: dbInput.session_date,
    sessionStartTime: dbInput.session_start_time,
    durationMinutes: dbInput.duration_minutes,
    location: dbInput.location,
    sessionTitle: dbInput.session_title,
    coFacilitators: dbInput.co_facilitators,
    evidenceNote: dbInput.evidence_note,
  }
}

export function transformPresentDbToApi(
  dbInput: PresentInput,
): PresentApiInput {
  return {
    linkedinUrl: dbInput.linkedin_url, // snake_case → camelCase
    screenshotUrl: dbInput.screenshot_url, // snake_case → camelCase
    caption: dbInput.caption,
  }
}

export function transformShineDbToApi(dbInput: ShineInput): ShineApiInput {
  return {
    ideaTitle: dbInput.idea_title, // snake_case → camelCase
    ideaSummary: dbInput.idea_summary, // snake_case → camelCase
    attachments: dbInput.attachments,
  }
}

// =============================================================================
// SAFE PARSERS FOR API LAYER
// =============================================================================

/**
 * Safe parsing functions for API payloads
 */

export function parseSubmissionApiPayload(
  payload: unknown,
): SubmissionApiPayload | null {
  const result = SubmissionApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseLearnApiPayload(payload: unknown): LearnApiPayload | null {
  const result = LearnApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseExploreApiPayload(
  payload: unknown,
): ExploreApiPayload | null {
  const result = ExploreApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseAmplifyApiPayload(
  payload: unknown,
): AmplifyApiPayload | null {
  const result = AmplifyApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parsePresentApiPayload(
  payload: unknown,
): PresentApiPayload | null {
  const result = PresentApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseShineApiPayload(payload: unknown): ShineApiPayload | null {
  const result = ShineApiPayloadSchema.safeParse(payload)
  return result.success ? result.data : null
}

// =============================================================================
// USAGE DOCUMENTATION
// =============================================================================

/**
 * USAGE EXAMPLE:
 *
 * // In API route handler:
 * const apiPayload = parseSubmissionApiPayload(request.body)
 * if (!apiPayload) {
 *   return { error: 'Invalid payload format' }
 * }
 *
 * // Transform for database storage:
 * const dbPayload = transformApiPayloadToDb(apiPayload)
 *
 * // Store in database (snake_case format):
 * await submissions.create({
 *   data: {
 *     activity_code: dbPayload.activityCode,
 *     payload: dbPayload.data,  // Now in snake_case format
 *     // ... other fields
 *   }
 * })
 *
 * // When returning to API (reverse transformation):
 * const apiResponse = transformDbPayloadToApi(dbPayload)
 * return { data: apiResponse }  // camelCase for frontend consumption
 */
