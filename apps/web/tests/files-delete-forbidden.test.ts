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

const submissionFindFirstMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    submission: { findFirst: submissionFindFirstMock },
  },
}))

describe('Files API - DELETE forbidden cases', () => {
  beforeEach(() => {
    currentUserId = 'owner'
    parseStoragePathMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    submissionFindFirstMock.mockReset()
  })

  it('forbids non-owner', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'someone_else', activityCode: 'LEARN' })
    const req = new Request('http://localhost/api/files/evidence/learn/someone_else/file.pdf', { method: 'DELETE' })
    const ctx: { params: Promise<{ path: string[] }> } = { params: Promise.resolve({ path: ['evidence','learn','someone_else','file.pdf'] }) }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(403)
  })

  it('forbids deletion if submission not pending', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'owner', activityCode: 'LEARN' })
    submissionFindFirstMock.mockResolvedValueOnce({ id: 'sub_1', status: 'APPROVED' })
    const req = new Request('http://localhost/api/files/evidence/learn/owner/file.pdf', { method: 'DELETE' })
    const ctx: { params: Promise<{ path: string[] }> } = { params: Promise.resolve({ path: ['evidence','learn','owner','file.pdf'] }) }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(400)
  })
})
