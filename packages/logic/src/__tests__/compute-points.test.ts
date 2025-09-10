import { describe, it, expect } from 'vitest'

import { computePoints } from '../scoring'

describe('computePoints via Activity Canon', () => {
  it('returns canon values for LEARN/EXPLORE/PRESENT', () => {
    expect(computePoints('LEARN', {})).toBeGreaterThanOrEqual(0)
    expect(computePoints('EXPLORE', {})).toBe(50)
    expect(computePoints('PRESENT', {})).toBe(20)
  })

  it('applies AMPLIFY coefficients with caps', () => {
    const payload = { peers_trained: 60, students_trained: 250 }
    // After caps: peers=50, students=200; points = 50*2 + 200*1 = 300
    expect(computePoints('AMPLIFY', payload)).toBe(300)
  })
})

