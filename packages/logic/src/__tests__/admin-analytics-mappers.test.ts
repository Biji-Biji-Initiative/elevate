import { describe, it, expect } from 'vitest'
import { buildActivityNameMap, mapActivityDistribution, mapTopBadges } from '../admin-analytics'

describe('admin-analytics mappers', () => {
  it('mapActivityDistribution maps codes to names and counts', () => {
    const activities = [
      { code: 'LEARN', name: 'Learn' },
      { code: 'EXPLORE', name: 'Explore' },
    ]
    const activityMap = buildActivityNameMap(activities)
    const result = mapActivityDistribution(
      [
        { activity_code: 'LEARN', _count: 3 },
        { activity_code: 'EXPLORE', _count: 2 },
      ],
      activityMap,
    )
    expect(result[0].activityName).toBe('Learn')
    expect(result[1].count).toBe(2)
  })

  it('mapTopBadges joins badge codes to details', () => {
    const grouped = [
      { badge_code: 'EARLY', _count: 5 },
      { badge_code: 'HERO', _count: 2 },
    ]
    const badges = [
      { code: 'EARLY', name: 'Early Adopter', description: 'desc', criteria: {}, icon_url: null },
      { code: 'HERO', name: 'Hero', description: 'desc', criteria: {}, icon_url: 'x' },
    ]
    const out = mapTopBadges(grouped, badges)
    expect(out[0].badge.code).toBe('EARLY')
    expect(out[0].earnedCount).toBe(5)
  })
})
