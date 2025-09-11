import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}))

const findManyMock = vi.fn()
const countMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: { auditLog: { findMany: findManyMock, count: countMock } },
}))

describe('Admin audit API - date filters', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
  })

  it('applies created_at range when startDate/endDate provided', async () => {
    const { GET } = await import('../app/api/admin/audit/route')
    findManyMock.mockImplementationOnce(async (args: { where?: { created_at?: { gte?: Date; lte?: Date } } }) => {
      expect(args?.where?.created_at?.gte).toBeInstanceOf(Date)
      expect(args?.where?.created_at?.lte).toBeInstanceOf(Date)
      return []
    })
    countMock.mockResolvedValueOnce(0)
    const req = new Request('http://localhost/api/admin/audit?startDate=2025-01-01&endDate=2025-01-31')
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
  })
})
