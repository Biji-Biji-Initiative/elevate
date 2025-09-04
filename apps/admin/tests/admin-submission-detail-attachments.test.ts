import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => {
  return {
    requireRole: vi.fn(async () => ({ userId: 'reviewer_1', role: 'reviewer' })),
    createErrorResponse: (err: unknown, status = 500) => new Response(JSON.stringify({ success: false, error: (err as Error)?.message || 'err' }), { status }),
  }
})

const findUniqueMock = vi.fn()

vi.mock('@elevate/db', async () => {
  return {
    prisma: {
      submission: {
        findUnique: findUniqueMock,
      },
    },
  }
})

describe('Admin submissions detail - attachmentCount via relation only', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('returns attachmentCount from attachments_rel', async () => {
    const { GET } = await import('../app/api/admin/submissions/[id]/route')

    findUniqueMock.mockResolvedValueOnce({
      id: 'sub_1',
      user: { id: 'u1', name: 'U', email: 'u@x', handle: 'u', school: null, cohort: null },
      activity: { code: 'LEARN', name: 'Learn' },
      attachments_rel: [
        { id: 'a1', submission_id: 'sub_1', path: 'evidence/x.pdf' },
        { id: 'a2', submission_id: 'sub_1', path: 'evidence/y.pdf' },
      ],
      attachments: ['legacy.json.should.not.be.used'],
    })

    const req = new Request('http://localhost/api/admin/submissions/sub_1')
    const params = Promise.resolve({ id: 'sub_1' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.submission.attachmentCount).toBe(2)
  })
})
