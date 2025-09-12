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
const deleteEvidenceFileMock = vi.fn()
vi.mock('@elevate/storage', async () => ({
  parseStoragePath: (p: string) => parseStoragePathMock(p),
  deleteEvidenceFile: (p: string) => deleteEvidenceFileMock(p),
}))

const submissionAttachmentFindFirstMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    submissionAttachment: { findFirst: submissionAttachmentFindFirstMock },
  },
}))

describe('Files API - DELETE forbidden cases', () => {
  beforeEach(() => {
    currentUserId = 'owner'
    parseStoragePathMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    submissionAttachmentFindFirstMock.mockReset()
  })

  it('forbids non-owner', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'someone_else', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce({ id: 'att', path: 'evidence/learn/someone_else/file.pdf', submission: { user_id: 'someone_else', status: 'PENDING' } })
    const req = new Request('http://localhost/api/files/evidence/learn/someone_else/file.pdf', { method: 'DELETE' })
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence','learn','someone_else','file.pdf'] } }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(403)
  })

  it('forbids deletion if submission not pending', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'owner', activityCode: 'LEARN' })
    submissionAttachmentFindFirstMock.mockResolvedValueOnce({ id: 'att', path: 'evidence/learn/owner/file.pdf', submission: { id: 'sub_1', user_id: 'owner', status: 'APPROVED' } })
    const req = new Request('http://localhost/api/files/evidence/learn/owner/file.pdf', { method: 'DELETE' })
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence','learn','owner','file.pdf'] } }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(400)
  })
})
