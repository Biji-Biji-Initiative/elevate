import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => {
  return {
    requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
    createErrorResponse: (err: unknown, status = 500) => new Response(JSON.stringify({ error: (err as Error)?.message || 'err' }), { status }),
  }
})

const findManyMock = vi.fn()
const countMock = vi.fn()

vi.mock('@elevate/db', async () => {
  return {
    prisma: {
      submission: {
        findMany: findManyMock,
        count: countMock,
      },
    },
  }
})

describe('Admin submissions API - GET', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
  })

  it('returns submissions with attachmentCount derived from relation', async () => {
    const { GET } = await import('../app/api/admin/submissions/route')

    findManyMock.mockResolvedValueOnce([
      {
        id: 'sub_1',
        user_id: 'user_1',
        activity_code: 'LEARN',
        status: 'PENDING',
        visibility: 'PRIVATE',
        attachments: [],
        attachments_rel: [{ id: 'a1', submission_id: 'sub_1', path: 'evidence/p.pdf' }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        review_note: null,
        user: { id: 'user_1', name: 'U', email: 'u@x', handle: 'u', school: null, cohort: null },
        activity: { code: 'LEARN', name: 'Learn', default_points: 20 },
      },
    ])
    countMock.mockResolvedValueOnce(1)

    const req = { url: 'http://localhost/api/admin/submissions?status=ALL&page=1&limit=50' } as any
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.submissions[0].attachmentCount).toBe(1)
  })
})

