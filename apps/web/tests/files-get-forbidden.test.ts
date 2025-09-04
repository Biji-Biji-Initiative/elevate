import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  apiRateLimiter: {},
}))

let currentUserId: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', async () => ({
  auth: async () => ({ userId: currentUserId }),
}))

const parseStoragePathMock = vi.fn()
const getSignedUrlMock = vi.fn()
vi.mock('@elevate/storage', async () => ({
  parseStoragePath: (p: string) => parseStoragePathMock(p),
  getSignedUrl: (p: string) => getSignedUrlMock(p),
}))

const userFindUniqueMock = vi.fn()
const submissionFindFirstMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    submission: { findFirst: submissionFindFirstMock },
  },
}))

describe('Files API - GET forbidden for non-owner non-reviewer', () => {
  beforeEach(() => {
    currentUserId = 'user_1'
    parseStoragePathMock.mockReset()
    getSignedUrlMock.mockReset()
    userFindUniqueMock.mockReset()
    submissionFindFirstMock.mockReset()
  })

  it('returns 403 for non-owner with participant role', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')
    userFindUniqueMock.mockResolvedValueOnce({ role: 'PARTICIPANT' })
    parseStoragePathMock.mockReturnValueOnce({ userId: 'someone_else', activityCode: 'LEARN' })
    const req = new Request('http://localhost/api/files/evidence/learn/someone_else/file.pdf')
    const ctx: { params: Promise<{ path: string[] }> } = { params: Promise.resolve({ path: ['evidence','learn','someone_else','file.pdf'] }) }
    const res = await GET(req, ctx)
    expect(res.status).toBe(403)
  })
})
