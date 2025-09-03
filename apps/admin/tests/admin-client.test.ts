import { describe, it, expect, beforeEach, vi } from 'vitest'
import { adminClient } from '../lib/admin-client'

function mockFetchOnce(status: number, json: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as any)
}

describe('adminClient', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('getCohorts parses success envelope', async () => {
    mockFetchOnce(200, { success: true, data: { cohorts: ['C1', 'C2'] } })
    const cohorts = await adminClient.getCohorts()
    expect(cohorts).toEqual(['C1', 'C2'])
  })

  it('getSubmissions parses list envelope', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        submissions: [
          {
            id: 'sub1',
            created_at: new Date().toISOString(),
            status: 'PENDING',
            visibility: 'PRIVATE',
            user: { id: 'u1', name: 'User', handle: 'user', email: 'u@example.com' },
            activity: { code: 'LEARN', name: 'Learn' },
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    })
    const res = await adminClient.getSubmissions({})
    expect(res.pagination.total).toBe(1)
    expect(res.submissions[0].id).toBe('sub1')
  })

  it('getUsers parses users list envelope', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        users: [
          {
            id: 'u1', handle: 'user', name: 'U', email: 'u@example.com',
            role: 'PARTICIPANT', created_at: new Date().toISOString(),
            _count: { submissions: 1, ledger: 1, earned_badges: 0 }, totalPoints: 5,
          }
        ],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    })
    const res = await adminClient.getUsers({})
    expect(res.users.length).toBe(1)
    expect(res.pagination.total).toBe(1)
  })

  it('getBadges parses badges list envelope', async () => {
    mockFetchOnce(200, {
      success: true,
      data: { badges: [{ code: 'EARLY', name: 'Early Adopter', description: 'desc', criteria: { type: 'points', threshold: 10 } }] }
    })
    const res = await adminClient.getBadges(true)
    expect(res.badges[0].code).toBe('EARLY')
  })

  it('getAnalytics parses analytics envelope', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        overview: { submissions: { total: 1, pending: 0, approved: 1, rejected: 0, approvalRate: 100 }, users: { total: 1, active: 1, withSubmissions: 1, withBadges: 0, activationRate: 100 }, points: { totalAwarded: 10, totalEntries: 1, avgPerEntry: 10 }, badges: { totalBadges: 1, totalEarned: 1, uniqueEarners: 1 }, reviews: { pendingReviews: 0, avgReviewTimeHours: 0 } },
        distributions: { submissionsByStatus: [], submissionsByActivity: [], usersByRole: [], usersByCohort: [], pointsByActivity: [], pointsDistribution: { totalUsers: 1, max: 10, min: 10, avg: 10, percentiles: [] } },
        trends: { submissionsByDate: [], userRegistrationsByDate: [] },
        recentActivity: { submissions: [], approvals: [], users: [] },
        performance: { reviewers: [], topBadges: [] }
      }
    })
    const res = await adminClient.getAnalytics({})
    expect(res.overview.submissions.total).toBe(1)
  })
})
