import { describe, it, expect, vi } from 'vitest'

vi.mock('@elevate/security/csrf', async () => ({
  withCSRFProtection: (handler: (req: Request) => Promise<Response> | Response) => handler,
}))
vi.mock('@elevate/security/rate-limiter', async () => ({
  submissionRateLimiter: {},
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
}))

vi.mock('@clerk/nextjs/server', async () => ({
  auth: async () => ({ userId: 'user_1' }),
}))

const userFindUniqueMock = vi.fn()
vi.mock('@elevate/db/client', async () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
  },
}), { virtual: true })

const findUserByIdMock = vi.fn()
vi.mock('@elevate/db', async () => ({
  findUserById: findUserByIdMock,
  findActivityByCode: vi.fn(),
  findSubmissionsByUserAndActivity: vi.fn(),
  countSubmissionsByUserAndActivity: vi.fn(),
  findSubmissionsWithPagination: vi.fn(),
  createSubmission: vi.fn(),
  createSubmissionAttachment: vi.fn(),
}), { virtual: true })

describe('Web submissions API - student eligibility', () => {
  it('returns 403 when user_type is STUDENT', async () => {
    const { POST } = await import('../app/api/submissions/route')
    userFindUniqueMock.mockResolvedValueOnce({ id: 'user_1', user_type: 'STUDENT' })

    const req = new Request('http://localhost/api/submissions', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('FORBIDDEN')
  })
})
