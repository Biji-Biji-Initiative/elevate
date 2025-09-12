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
const submissionAttachmentFindFirstMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    submissionAttachment: { findFirst: submissionAttachmentFindFirstMock },
  },
}))

describe('Files API - GET forbidden for non-owner non-reviewer', () => {
  beforeEach(() => {
    currentUserId = 'user_1'
    parseStoragePathMock.mockReset()
    getSignedUrlMock.mockReset()
    userFindUniqueMock.mockReset()
    submissionAttachmentFindFirstMock.mockReset()
  })

  it('returns 403 for non-owner with participant role', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')
    userFindUniqueMock.mockResolvedValueOnce({ role: 'PARTICIPANT' })
    parseStoragePathMock.mockReturnValueOnce({ userId: 'someone_else', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce({ id: 'att_1', path: 'evidence/learn/someone_else/file.pdf', submission: { user_id: 'someone_else', status: 'PENDING' } })
    const req = new Request('http://localhost/api/files/evidence/learn/someone_else/file.pdf')
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence','learn','someone_else','file.pdf'] } }
    const res = await GET(req, ctx)
    expect(res.status).toBe(403)
  })
})
