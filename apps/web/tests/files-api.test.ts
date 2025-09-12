import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'

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
const submissionAttachmentFindFirstMock = vi.fn()
const deleteAttachmentMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    submissionAttachment: { findFirst: submissionAttachmentFindFirstMock, delete: deleteAttachmentMock },
  },
}))

describe('Files API', () => {
  beforeEach(() => {
    currentUserId = 'user_1'
    parseStoragePathMock.mockReset()
    getSignedUrlMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    userFindUniqueMock.mockReset()
    submissionAttachmentFindFirstMock.mockReset()
    deleteAttachmentMock.mockReset()
  })

  it('requires auth on GET', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')
    currentUserId = null
    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf')
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence', 'learn', 'user_1', 'file.pdf'] } }
    const res = await GET(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns signed url for owner', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')

    userFindUniqueMock.mockResolvedValueOnce({ role: 'PARTICIPANT' })
    parseStoragePathMock.mockReturnValueOnce({ userId: 'user_1', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce({ id: 'att_1', path: 'evidence/learn/user_1/file.pdf', submission: { user_id: 'user_1', status: 'PENDING' } })
    getSignedUrlMock.mockResolvedValueOnce('https://signed.url/test')

    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf')
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence', 'learn', 'user_1', 'file.pdf'] } }
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const json = await readJson<{ success: boolean; data: { url: string } }>(res)
    expect(json.success).toBe(true)
    expect(json.data.url).toContain('https://signed.url/test')
  })
})
