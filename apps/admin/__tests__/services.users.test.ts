import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/server/users-service', () => ({
  listUsersService: vi.fn(async () => ({
    users: [
      {
        id: 'u_1',
        handle: 'alice',
        name: 'Alice',
        email: 'alice@example.com',
        avatar_url: null,
        role: 'PARTICIPANT',
        school: null,
        cohort: null,
        created_at: new Date().toISOString(),
        _count: { submissions: 0, ledger: 0, earned_badges: 0 },
        totalPoints: 0,
      },
    ],
    pagination: { page: 1, limit: 50, total: 1, pages: 1 },
  })),
}))

const { listUsers } = await import('../lib/services/users')

describe('services/users.listUsers (server-first)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns users + pagination', async () => {
    const result = await listUsers({ page: 1, limit: 50 })
    expect(result.pagination.total).toBe(1)
    expect(result.users).toHaveLength(1)
    const first = result.users[0]!
    expect(first.handle).toBe('alice')
  })
})
