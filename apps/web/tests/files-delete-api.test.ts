import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'

vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  apiRateLimiter: {},
}))

let currentUserId: string | null = 'user_1'
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

describe('Files API - DELETE', () => {
  beforeEach(() => {
    currentUserId = 'user_1'
    parseStoragePathMock.mockReset()
    deleteEvidenceFileMock.mockReset()
    submissionFindFirstMock.mockReset()
  })

  it('requires auth', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    currentUserId = null
    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf', { method: 'DELETE' })
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence', 'learn', 'user_1', 'file.pdf'] } }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(401)
  })

  it('deletes file for owner with pending submission', async () => {
    const { DELETE } = await import('../app/api/files/[...path]/route')
    parseStoragePathMock.mockReturnValueOnce({ userId: 'user_1', activityCode: 'LEARN' })
    submissionFindFirstMock.mockResolvedValueOnce({ id: 'sub_1', status: 'PENDING' })
    deleteEvidenceFileMock.mockResolvedValueOnce(undefined)

    const req = new Request('http://localhost/api/files/evidence/learn/user_1/file.pdf', { method: 'DELETE' })
    const ctx: { params: { path: string[] } } = { params: { path: ['evidence', 'learn', 'user_1', 'file.pdf'] } }
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(200)
    const json = await readJson<{ success: boolean }>(res)
    expect(json.success).toBe(true)
  })
})
