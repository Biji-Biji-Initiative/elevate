import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

const findManyMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: { auditLog: { findMany: findManyMock } },
}))

describe('Admin audit export CSV', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('returns CSV with header and rows', async () => {
    const { GET } = await import('../app/api/admin/audit/export.csv/route')
    findManyMock.mockResolvedValueOnce([
      { created_at: new Date('2025-01-02T03:04:05Z'), action: 'TEST', actor_id: 'system', target_id: 'user_1', meta: { a: 1 } },
    ])
    findManyMock.mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/admin/audit/export.csv')
    const res = await GET(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.split('\n')
    expect(lines[0]).toContain('created_at,action,actor_id,target_id,meta')
    expect(text).toContain('TEST')
  })
})
