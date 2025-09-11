import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}))

const findManyMock = vi.fn()
const countMock = vi.fn()
const groupByMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: {
    user: { findMany: findManyMock, count: countMock },
    pointsLedger: { groupBy: groupByMock },
  },
}))

describe('Admin users list API - GET filters', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
    groupByMock.mockReset()
  })

  it('applies userType filter', async () => {
    const { GET } = await import('../app/api/admin/users/route')
    // minimal rows
    findManyMock.mockImplementationOnce(async (args: Record<string, unknown>) => {
      // expect filter applied
      let userType: string | undefined
      if (args && typeof args === 'object' && 'where' in args) {
        const where = (args as Record<string, unknown>).where as Record<string, unknown> | undefined
        const ut = where && typeof where.user_type === 'string' ? (where.user_type as string) : undefined
        userType = ut
      }
      expect(userType).toBe('EDUCATOR')
      return [
        { id: 'u1', handle: 'u', name: 'U', email: 'u@x', avatar_url: null, role: 'PARTICIPANT', user_type: 'EDUCATOR', user_type_confirmed: true, school: null, cohort: null, created_at: new Date(), _count: { submissions: 0, ledger: 0, earned_badges: 0 } },
      ]
    })
    countMock.mockResolvedValueOnce(1)
    groupByMock.mockResolvedValueOnce([{ user_id: 'u1', _sum: { delta_points: 10 } }])

    const req = new Request('http://localhost/api/admin/users?userType=EDUCATOR&page=1&limit=50')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.users[0].user_type).toBe('EDUCATOR')
  })
})
