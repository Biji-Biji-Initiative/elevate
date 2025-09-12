import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

const findManyMock = vi.fn()
const groupByMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: {
    user: { findMany: findManyMock },
    pointsLedger: { groupBy: groupByMock },
  },
}))

describe('Admin users export CSV', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    groupByMock.mockReset()
  })

  it('returns CSV content with header', async () => {
    const { GET } = await import('../app/api/admin/users/export.csv/route')
    findManyMock.mockResolvedValueOnce([
      { id: 'u1', name: '=cmd', handle: 'user1', email: 'u1@x', role: 'PARTICIPANT', user_type: 'EDUCATOR', user_type_confirmed: true, kajabi_contact_id: '123', school: null, cohort: null, created_at: new Date() },
    ])
    groupByMock.mockResolvedValueOnce([{ user_id: 'u1', _sum: { delta_points: 10 } }])
    // Second page empty to end loop
    findManyMock.mockResolvedValueOnce([])

    const req = new Request('http://localhost/api/admin/users/export.csv', { headers: { 'X-Trace-Id': 't-users' } })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Trace-Id')).toBe('t-users')
    const text = await res.text()
    expect(text.split('\n')[0]).toContain('id,name,handle,email,role,user_type')
    expect(text).toContain('u1')
    // Name starting with '=' should be prefixed with an apostrophe
    const firstRow = text.split('\n')[1]
    expect(firstRow.split(',')[1].startsWith("'=")).toBe(true)
  })
})
