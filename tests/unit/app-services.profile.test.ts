import { describe, it, expect } from 'vitest'

import { getPublicProfileByHandleService, type ProfileServiceDeps } from '@elevate/app-services'

describe('@elevate/app-services getPublicProfileByHandleService (DI)', () => {
  it('returns null when profile not found', async () => {
    const deps: Partial<ProfileServiceDeps> = {
      getPublicProfileByHandle: async () => null,
      prisma: {
        pointsLedger: {
          aggregate: async () => ({ _sum: { delta_points: 0 } }),
        },
      } as any,
    }
    const res = await getPublicProfileByHandleService('missing', deps)
    expect(res).toBeNull()
  })

  it('maps profile with aggregated points', async () => {
    const created = new Date('2024-01-01T00:00:00.000Z')
    const deps: Partial<ProfileServiceDeps> = {
      getPublicProfileByHandle: async () => ({
        id: 'u1',
        handle: 'alice',
        name: 'Alice',
        school: 'River High',
        cohort: '2024',
        created_at: created,
        earned_badges: [],
        submissions: [],
      }),
      prisma: {
        pointsLedger: {
          aggregate: async () => ({ _sum: { delta_points: 99 } }),
        },
      } as any,
    }
    const res = await getPublicProfileByHandleService('alice', deps)
    expect(res?.id).toBe('u1')
    expect(res?.handle).toBe('alice')
    expect(res?.totalPoints).toBe(99)
    expect(res?.submissions.length).toBe(0)
  })
})

