import { z } from 'zod'

import {
  ACTIVITY_CODES,
  LEDGER_SOURCES,
  type ActivityCode,
  type LedgerSource,
} from './domain-constants'

/**
 * Activity Canon
 * Centralized mapping of activity codes to their point rules and sources.
 * This is a declarative, dependency-free description used by scoring logic.
 */

export const activitySources: Record<ActivityCode, LedgerSource> = {
  LEARN: 'WEBHOOK',
  EXPLORE: 'MANUAL',
  AMPLIFY: 'MANUAL',
  PRESENT: 'MANUAL',
  SHINE: 'MANUAL',
}

export const learnRules = {
  perTag: 10,
  cap: 20,
}

export const exploreRules = {
  onApproved: 50,
}

export const presentRules = {
  onApproved: 20,
}

export const amplifyRules = {
  peersCoefficient: 2,
  studentsCoefficient: 1,
  limits: {
    weeklyPeers: 50,
    weeklyStudents: 200,
  },
}

export const activityCanon = {
  sources: activitySources,
  learn: learnRules,
  explore: exploreRules,
  present: presentRules,
  amplify: amplifyRules,
} as const

// Runtime validation schema (optional consumers)
export const ActivityCanonSchema = z.object({
  sources: z.record(z.enum(ACTIVITY_CODES), z.enum(LEDGER_SOURCES)),
  learn: z.object({ perTag: z.number().int().nonnegative(), cap: z.number().int().nonnegative() }),
  explore: z.object({ onApproved: z.number().int().nonnegative() }),
  present: z.object({ onApproved: z.number().int().nonnegative() }),
  amplify: z.object({
    peersCoefficient: z.number().int().nonnegative(),
    studentsCoefficient: z.number().int().nonnegative(),
    limits: z.object({
      weeklyPeers: z.number().int().nonnegative(),
      weeklyStudents: z.number().int().nonnegative(),
    }),
  }),
})

// Badge canon — centralize badge linkage and criteria
export const badgeCanon = {
  STARTER: {
    description: 'Earned when both Learn course tags are present',
    requiresTags: ['elevate-ai-1-completed', 'elevate-ai-2-completed'] as const,
  },
  IN_CLASS_INNOVATOR: {
    description: 'First approved EXPLORE submission',
    requiresApprovedActivity: 'EXPLORE' as const,
  },
  COMMUNITY_VOICE: {
    description: 'First approved PRESENT submission',
    requiresApprovedActivity: 'PRESENT' as const,
  },
} as const

export type BadgeCodeCanon = keyof typeof badgeCanon
