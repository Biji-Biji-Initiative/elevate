import { expectTypeOf, describe, it, expect } from 'vitest'

import { AmplifyApiSchema, type AmplifyApiInput } from '../submission-payloads.api'

describe('AmplifyApiSchema', () => {
  it('matches spec fields', () => {
    const sample: AmplifyApiInput = {
      peersTrained: 1,
      studentsTrained: 2,
      attendanceProofFiles: ['proof.pdf'],
      sessionDate: '2024-01-01',
      sessionStartTime: '09:00',
      durationMinutes: 60,
      location: { venue: 'Hall', city: 'Jakarta', country: 'ID' },
      sessionTitle: 'Intro Session',
      coFacilitators: ['Jane'],
      evidenceNote: 'notes',
    }
    expect(AmplifyApiSchema.safeParse(sample).success).toBe(true)
  })

  it('requires sessionDate', () => {
    const result = AmplifyApiSchema.safeParse({
      peersTrained: 1,
      studentsTrained: 1,
    })
    expect(result.success).toBe(false)
  })

  it('type matches docs', () => {
    expectTypeOf<AmplifyApiInput>().toMatchTypeOf<{
      peersTrained: number
      studentsTrained: number
      attendanceProofFiles?: string[]
      sessionDate: string
      sessionStartTime?: string
      durationMinutes?: number
      location?: { venue?: string; city?: string; country?: string }
      sessionTitle?: string
      coFacilitators?: string[]
      evidenceNote?: string
    }>()
  })
})
