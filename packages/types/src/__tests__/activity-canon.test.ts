import { describe, it, expect } from 'vitest'

import { computeAmplifyPoints, clampAmplifyWeekly, activityCanon } from '../activity-canon'

describe('activity-canon helpers', () => {
  it('computes amplify points using coefficients', () => {
    expect(computeAmplifyPoints(0, 0)).toBe(0)
    expect(computeAmplifyPoints(5, 10)).toBe(5 * activityCanon.amplify.peersCoefficient + 10 * activityCanon.amplify.studentsCoefficient)
  })

  it('clamps weekly peers/students to policy limits', () => {
    const { weeklyPeers, weeklyStudents } = activityCanon.amplify.limits
    const clamped = clampAmplifyWeekly(weeklyPeers + 10, weeklyStudents + 50)
    expect(clamped.peers).toBe(weeklyPeers)
    expect(clamped.students).toBe(weeklyStudents)
  })
})

