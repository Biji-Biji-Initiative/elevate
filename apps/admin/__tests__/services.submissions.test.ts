import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/server/submissions-service', () => ({
  listSubmissionsService: vi.fn(async () => ({
    submissions: [
      {
        id: 's_1',
        created_at: new Date().toISOString(),
        status: 'PENDING',
        visibility: 'PRIVATE',
        review_note: null,
        user: { id: 'u_1', name: 'Alice', email: 'alice@example.com', handle: 'alice', school: null, cohort: null },
        activity: { code: 'BUILD', name: 'Build', default_points: 20 },
        attachments_rel: [],
        attachmentCount: 0,
      },
    ],
    pagination: { page: 1, limit: 50, total: 1, pages: 1 },
  })),
}))

vi.mock('@elevate/db', async (orig) => {
  const mod = (await orig()) as Record<string, unknown>
  return {
    ...mod,
    prisma: {
      user: {
        findMany: vi.fn(async () => [{ cohort: 'C1' }, { cohort: 'C2' }, { cohort: null }]),
      },
    },
  }
})

const { listSubmissions, getCohorts } = await import('../lib/services/submissions')

describe('services/submissions (server-first)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('listSubmissions returns data', async () => {
    const result = await listSubmissions({ page: 1, limit: 50 })
    expect(result.pagination.total).toBe(1)
    expect(result.submissions).toHaveLength(1)
    const first = result.submissions[0]!
    expect(first.status).toBe('PENDING')
  })

  it('getCohorts returns distinct cohort list', async () => {
    const cohorts = await getCohorts()
    expect(cohorts).toEqual(['C1', 'C2'])
  })
})
