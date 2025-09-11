import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prisma mocks
const queryRawMock = vi.fn()
const earnedBadgeFindManyMock = vi.fn()

vi.mock('@elevate/db/client', async () => ({
  prisma: {
    $queryRaw: queryRawMock,
    earnedBadge: { findMany: earnedBadgeFindManyMock },
  },
}))

describe('Leaderboard API - basic shape', () => {
  beforeEach(() => {
    queryRawMock.mockReset()
    earnedBadgeFindManyMock.mockReset()
  })

  it('returns envelope + pagination with entries', async () => {
    const { GET } = await import('../app/api/leaderboard/route')

    // First call: COUNT(*)
    queryRawMock.mockResolvedValueOnce([{ count: BigInt(2) }])
    // Second call: leaderboard data rows
    queryRawMock.mockResolvedValueOnce([
      {
        user_id: 'u1',
        handle: 'h1',
        name: 'N1',
        avatar_url: null,
        school: null,
        cohort: null,
        total_points: 100,
        public_submissions: 1,
        last_activity_at: new Date(),
        learn_points: 20,
        explore_points: 50,
        amplify_points: 10,
        present_points: 20,
        shine_points: 0,
      },
      {
        user_id: 'u2',
        handle: 'h2',
        name: 'N2',
        avatar_url: null,
        school: 'S',
        cohort: 'C',
        total_points: 80,
        public_submissions: 2,
        last_activity_at: new Date(),
        learn_points: 20,
        explore_points: 30,
        amplify_points: 20,
        present_points: 10,
        shine_points: 0,
      },
    ])
    earnedBadgeFindManyMock.mockResolvedValueOnce([])

    const req = new Request(
      'http://localhost/api/leaderboard?period=all&limit=2&offset=0',
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    const json = JSON.parse(text) as { success: boolean; data: { data: unknown[]; total: number; limit: number; offset: number } }
    expect(json.success).toBe(true)
    // New envelope shape: { success, data: { period, data: [...], total, limit, offset } }
    expect(Array.isArray(json.data.data)).toBe(true)
    expect(json.data.total).toBe(2)
    expect(json.data.limit).toBe(2)
    expect(json.data.offset).toBe(0)
    expect(json.data.data[0]).toHaveProperty('rank')
    expect(json.data.data[0]).toHaveProperty('user')
  })
})
