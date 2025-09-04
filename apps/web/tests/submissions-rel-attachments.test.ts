import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bypass CSRF and rate limiting wrappers
vi.mock('@elevate/security/csrf', async () => ({
  withCSRFProtection: (handler: any) => handler,
}))
vi.mock('@elevate/security/rate-limiter', async () => ({
  submissionRateLimiter: {},
  withRateLimit: async (_req: any, _limiter: any, handler: any) => handler(),
}))

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', async () => ({
  auth: async () => ({ userId: 'user_1' }),
}))

// Prisma mocks
const createSubmissionMock = vi.fn()
const createManyAttachmentsMock = vi.fn()
const userFindUniqueMock = vi.fn()
const activityFindUniqueMock = vi.fn()

vi.mock('@elevate/db/client', async () => ({
  prisma: {
    submission: { create: createSubmissionMock },
    submissionAttachment: { createMany: createManyAttachmentsMock },
    user: { findUnique: userFindUniqueMock },
    activity: { findUnique: activityFindUniqueMock },
  },
}))

describe('Web submissions API - relational attachments creation', () => {
  beforeEach(() => {
    createSubmissionMock.mockReset()
    createManyAttachmentsMock.mockReset()
    userFindUniqueMock.mockReset()
    activityFindUniqueMock.mockReset()
  })

  it('persists attachments to submission_attachments on POST', async () => {
    const { POST } = await import('../app/api/submissions/route')

    userFindUniqueMock.mockResolvedValueOnce({ id: 'user_1' })
    activityFindUniqueMock.mockResolvedValueOnce({ code: 'LEARN', default_points: 20 })
    createSubmissionMock.mockResolvedValueOnce({ id: 'sub_1', activity: { name: 'Learn' }, visibility: 'PRIVATE', status: 'PENDING', created_at: new Date().toISOString() })

    const req = {
      json: async () => ({
        activityCode: 'LEARN',
        payload: { provider: 'SPL', course: 'AI 101', completedAt: new Date().toISOString() },
        attachments: ['evidence/learn/user_1/cert.pdf']
      })
    } as any

    const res = await POST(req as any)
    expect(res.status).toBe(201)
    expect(createManyAttachmentsMock).toHaveBeenCalledTimes(1)
    const arg = createManyAttachmentsMock.mock.calls[0]?.[0]
    expect(Array.isArray(arg.data)).toBe(true)
    expect(arg.data[0]).toMatchObject({ path: 'evidence/learn/user_1/cert.pdf' })
  })
})

