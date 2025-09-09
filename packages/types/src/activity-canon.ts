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
  }),
})
