import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth bypass: require admin
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

// Logger noop
vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}))

// Clerk client mock
const updateUserMock = vi.fn()
vi.mock('@clerk/nextjs/server', async () => ({
  clerkClient: async () => ({ users: { updateUser: updateUserMock } }),
}))

// Prisma mock
const updateMock = vi.fn()
vi.mock('@elevate/db', async () => ({
  prisma: { user: { update: updateMock } },
}))

describe('Admin bulk LEAPS update API', () => {
  beforeEach(() => {
    updateMock.mockReset()
    updateUserMock.mockReset()
  })

  it('updates multiple users and mirrors to Clerk when userType provided', async () => {
    const { POST } = await import('../app/api/admin/users/leaps/route')
    updateMock.mockResolvedValue({ id: 'u1' })
    const body = JSON.stringify({ userIds: ['u1', 'u2'], userType: 'EDUCATOR', userTypeConfirmed: true })
    const req = new Request('http://localhost/api/admin/users/leaps', { method: 'POST', body, headers: { 'content-type': 'application/json' } })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.processed + json.data.failed).toBe(2)
    expect(updateUserMock).toHaveBeenCalled()
  })

  it('rejects more than 100 userIds', async () => {
    const { POST } = await import('../app/api/admin/users/leaps/route')
    const ids = Array.from({ length: 101 }, (_, i) => `u${i}`)
    const body = JSON.stringify({ userIds: ids, userTypeConfirmed: true })
    const req = new Request('http://localhost/api/admin/users/leaps', { method: 'POST', body, headers: { 'content-type': 'application/json' } })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
