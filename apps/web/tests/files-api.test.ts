import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate limiter passthrough
vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  apiRateLimiter: {},
}))

// Mock Clerk auth
let currentUserId: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', async () => ({
  auth: async () => ({ userId: currentUserId }),
}))

// Mock storage utils
const parseStoragePathMock = vi.fn()
const getSignedUrlMock = vi.fn()
const deleteEvidenceFileMock = vi.fn()
vi.mock('@elevate/storage', async () => ({
  parseStoragePath: (p: string) => parseStoragePathMock(p),
  getSignedUrl: (p: string) => getSignedUrlMock(p),
  deleteEvidenceFile: (p: string) => deleteEvidenceFileMock(p),
}))

// Mock prisma
const userFindUniqueMock = vi.fn()
const submissionFindFirstMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    submission: { findFirst: submissionFindFirstMock },
  },
}))

describe('Files API', () => {
  beforeEach(() => {
    currentUserId = 'user_1'
    parseStoragePathMock.mockReset()
    getSignedUrlMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    userFindUniqueMock.mockReset()
    submissionFindFirstMock.mockReset()
  })

  it('requires auth on GET', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')
    currentUserId = null
    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf')
    const ctx: { params: Promise<{ path: string[] }> } = { params: Promise.resolve({ path: ['evidence', 'learn', 'user_1', 'file.pdf'] }) }
    const res = await GET(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns signed url for owner', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')

    userFindUniqueMock.mockResolvedValueOnce({ role: 'PARTICIPANT' })
    parseStoragePathMock.mockReturnValueOnce({ userId: 'user_1', activityCode: 'LEARN' })
    submissionFindFirstMock.mockResolvedValueOnce({ id: 'sub_1' })
    getSignedUrlMock.mockResolvedValueOnce('https://signed.url/test')

    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf')
    const ctx: { params: Promise<{ path: string[] }> } = { params: Promise.resolve({ path: ['evidence', 'learn', 'user_1', 'file.pdf'] }) }
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.url).toContain('https://signed.url/test')
  })
})
