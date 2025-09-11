import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}))

const countMock = vi.fn()
const queryRawMock = vi.fn()
const aggregateMock = vi.fn()
const groupByMock = vi.fn()
const findManyUsersMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: {
    referralEvent: { count: countMock },
    $queryRaw: queryRawMock,
    pointsLedger: { aggregate: aggregateMock, groupBy: groupByMock },
    user: { findMany: findManyUsersMock },
  },
}))

describe('Admin referrals summary API', () => {
  beforeEach(() => {
    countMock.mockReset()
    queryRawMock.mockReset()
    aggregateMock.mockReset()
    groupByMock.mockReset()
    findManyUsersMock.mockReset()
  })

  it('returns monthly totals, unique referrers, points awarded, and top referrers', async () => {
    const { GET } = await import('../app/api/admin/referrals/summary/route')

    // referralEvent.count called 3x: total, educators, students
    countMock
      .mockResolvedValueOnce(3) // total
      .mockResolvedValueOnce(1) // educators
      .mockResolvedValueOnce(2) // students

    // DISTINCT referrers count via raw query
    queryRawMock.mockResolvedValueOnce([{ cnt: 2n }])

    // Points awarded this month via pointsLedger.aggregate
    aggregateMock.mockResolvedValueOnce({ _sum: { delta_points: 7 } })

    // Top referrers via pointsLedger.groupBy
    groupByMock.mockResolvedValueOnce([
      { user_id: 'u1', _sum: { delta_points: 5 } },
      { user_id: 'u2', _sum: { delta_points: 2 } },
    ])

    // Enrich top referrers with user records
    findManyUsersMock.mockResolvedValueOnce([
      { id: 'u1', name: 'Alice', email: 'a@x', handle: 'alice', user_type: 'EDUCATOR' },
      { id: 'u2', name: 'Bob', email: 'b@x', handle: 'bob', user_type: 'STUDENT' },
    ])

    const req = new Request('http://localhost/api/admin/referrals/summary?month=2025-09')
    const res = await GET(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.month).toBe('2025-09')
    expect(json.data.total).toBe(3)
    expect(json.data.byType.educators).toBe(1)
    expect(json.data.byType.students).toBe(2)
    expect(json.data.uniqueReferrers).toBe(2)
    expect(json.data.pointsAwarded).toBe(7)
    expect(json.data.topReferrers).toHaveLength(2)
    expect(json.data.topReferrers[0].userId).toBe('u1')
    expect(json.data.topReferrers[0].points).toBe(5)
    expect(json.data.topReferrers[0].user.name).toBe('Alice')
  })
})

