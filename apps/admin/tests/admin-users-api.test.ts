import { describe, it, expect, vi, beforeEach } from 'vitest'

// Auth bypass: require admin
vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

// No-op logger
vi.mock('@elevate/logging/safe-server', async () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

// Clerk client mock
const updateUserMock = vi.fn()
vi.mock('@clerk/nextjs/server', async () => ({
  clerkClient: async () => ({ users: { updateUser: updateUserMock } }),
}))

// Prisma client mock
const findUniqueMock = vi.fn()
const updateMock = vi.fn()
vi.mock('@elevate/db', async () => ({
  prisma: {
    user: { findUnique: findUniqueMock, update: updateMock },
  },
}))

describe('Admin users API', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
    updateUserMock.mockReset()
  })

  it('GET /api/admin/users/{id} returns user', async () => {
    const { GET } = await import('../app/api/admin/users/[id]/route')
    const sample = {
      id: 'u1',
      email: 'u@example.com',
      name: 'User',
      handle: 'user',
      user_type: 'EDUCATOR',
      user_type_confirmed: true,
      school: 'Universitas Indonesia',
      region: 'DKI Jakarta',
      kajabi_contact_id: '12345',
      created_at: new Date().toISOString(),
    }
    findUniqueMock.mockResolvedValueOnce(sample)

    const req = new Request('http://localhost/api/admin/users/u1')
    const res = await GET(req, { params: { id: 'u1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.user.id).toBe('u1')
    expect(json.data.user.user_type).toBe('EDUCATOR')
  })

  it('PATCH /api/admin/users/{id} updates DB and mirrors to Clerk when userType provided', async () => {
    const { PATCH } = await import('../app/api/admin/users/[id]/route')
    // Existing user check
    findUniqueMock.mockResolvedValueOnce({ id: 'u1' })
    // Update return payload
    updateMock.mockResolvedValueOnce({
      id: 'u1',
      email: 'u@example.com',
      name: 'User',
      handle: 'user',
      user_type: 'STUDENT',
      user_type_confirmed: true,
      school: null,
      region: null,
      kajabi_contact_id: null,
      created_at: new Date().toISOString(),
    })

    const body = JSON.stringify({ userType: 'STUDENT', userTypeConfirmed: true })
    const req = new Request('http://localhost/api/admin/users/u1', { method: 'PATCH', body, headers: { 'content-type': 'application/json' } })
    const res = await PATCH(req, { params: { id: 'u1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.user.user_type).toBe('STUDENT')
    expect(updateUserMock).toHaveBeenCalledWith('u1', { publicMetadata: { user_type: 'STUDENT' } })
  })
})

