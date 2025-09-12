import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  apiRateLimiter: {},
}))

let currentUserId: string | null = 'owner'
vi.mock('@clerk/nextjs/server', async () => ({
  auth: async () => ({ userId: currentUserId }),
}))

const parseStoragePathMock = vi.fn()
const getSignedUrlMock = vi.fn()
const deleteEvidenceFileMock = vi.fn()
vi.mock('@elevate/storage', async () => ({
  parseStoragePath: (p: string) => parseStoragePathMock(p),
  getSignedUrl: (p: string) => getSignedUrlMock(p),
  deleteEvidenceFile: (p: string) => deleteEvidenceFileMock(p),
}))

const userFindUniqueMock = vi.fn()
const submissionAttachmentFindFirstMock = vi.fn()
const deleteAttachmentMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    submissionAttachment: { findFirst: submissionAttachmentFindFirstMock, delete: deleteAttachmentMock },
  },
}))

describe('Files API - requires attachment record', () => {
  beforeEach(() => {
    currentUserId = 'owner'
    parseStoragePathMock.mockReset()
    getSignedUrlMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    userFindUniqueMock.mockReset()
    submissionAttachmentFindFirstMock.mockReset()
    deleteAttachmentMock.mockReset()
  })

  it('GET returns 404 when no attachment found', async () => {
    const { GET } = await import('../app/api/files/[...path]/route')
    userFindUniqueMock.mockResolvedValueOnce({ role: 'PARTICIPANT' })
    parseStoragePathMock.mockReturnValueOnce({ userId: 'owner', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/files/evidence/learn/owner/file.pdf')
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence','learn','owner','file.pdf'] } }
    const res = await GET(req, ctx)
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 when no attachment found', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'owner', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/files/evidence/learn/owner/file.pdf', { method: 'DELETE' })
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence','learn','owner','file.pdf'] } }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(404)
  })
})

