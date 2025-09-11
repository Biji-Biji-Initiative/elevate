import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

// Logger noop
vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}))

// Prisma for user lookup
const findUniqueMock = vi.fn()
vi.mock('@elevate/db', async () => ({
  prisma: { user: { findUnique: findUniqueMock, update: vi.fn() }, auditLog: { create: vi.fn() } },
}))

// Integrations: enroll user mock
vi.mock('@elevate/integrations', async () => ({
  enrollUserInKajabi: vi.fn(async () => ({ success: true, contactId: 12345 })),
  getKajabiClient: vi.fn(),
}))

describe('Admin Kajabi invite API', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('enrolls by userId and returns success', async () => {
    const { POST } = await import('../app/api/admin/kajabi/invite/route')
    findUniqueMock.mockResolvedValueOnce({ id: 'u1', email: 'u@example.com', name: 'User' })
    const body = JSON.stringify({ userId: 'u1' })
    const req = new Request('http://localhost/api/admin/kajabi/invite', { method: 'POST', body, headers: { 'content-type': 'application/json' } })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invited).toBe(true)
    expect(json.data.contactId).toBe(12345)
  })
})
