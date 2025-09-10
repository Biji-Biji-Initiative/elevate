import { describe, it, expect } from 'vitest'
import { getOpenApiSpec } from '../spec'
import {
  PlatformStatsResponseSchema,
  StageMetricsResponseSchema,
  ProfileResponseSchema,
  AdminUsersListResponseSchema,
} from '../schemas'

describe('OpenAPI contract', () => {
  it('includes public endpoints', () => {
    const spec = getOpenApiSpec()
    const paths = spec.paths || {}
    expect(paths['/api/stats']).toBeDefined()
    expect(paths['/api/metrics']).toBeDefined()
    expect(paths['/api/profile/{handle}']).toBeDefined()
  })

  it('validates example platform stats', () => {
    const sample = {
      success: true,
      data: {
        totalEducators: 100,
        totalSubmissions: 250,
        totalPoints: 12345,
        studentsImpacted: 5000,
        byStage: {
          learn: { total: 50, approved: 40, pending: 5, rejected: 5 },
          explore: { total: 50, approved: 35, pending: 10, rejected: 5 },
          amplify: { total: 50, approved: 30, pending: 15, rejected: 5 },
          present: { total: 50, approved: 25, pending: 20, rejected: 5 },
          shine: { total: 50, approved: 20, pending: 25, rejected: 5 },
        },
        topCohorts: [{ name: 'Cohort-2024-A', count: 25, avgPoints: 120 }],
        monthlyGrowth: [{ month: '2025-01', educators: 10, submissions: 25 }],
        badges: {
          totalAwarded: 300,
          uniqueBadges: 10,
          mostPopular: [{ code: 'FIRST', name: 'First Badge', count: 100 }],
        },
      },
    }
    expect(() => PlatformStatsResponseSchema.parse(sample)).not.toThrow()
  })

  it('validates example stage metrics', () => {
    const sample = {
      success: true,
      data: {
        stage: 'learn',
        totalSubmissions: 10,
        approvedSubmissions: 8,
        pendingSubmissions: 1,
        rejectedSubmissions: 1,
        avgPointsEarned: 20,
        uniqueEducators: 10,
        topSchools: [{ name: 'SDN 1', count: 5 }],
        cohortBreakdown: [{ cohort: 'Cohort-2024-A', count: 7 }],
        monthlyTrend: [{ month: 'Jan 2025', submissions: 5, approvals: 4 }],
        completionRate: 80,
      },
    }
    expect(() => StageMetricsResponseSchema.parse(sample)).not.toThrow()
  })

  it('validates example profile response', () => {
    const sample = {
      success: true,
      data: {
        id: 'user_1',
        handle: 'educator_1',
        name: 'Educator',
        email: 'educator@example.com',
        avatarUrl: null,
        school: null,
        cohort: null,
        createdAt: new Date().toISOString(),
        totalPoints: 100,
        earnedBadges: [
          {
            earnedAt: new Date().toISOString(),
            badge: {
              code: 'FIRST',
              name: 'First',
              description: 'desc',
              iconUrl: null,
            },
          },
        ],
        submissions: [
          {
            id: 'sub_1',
            activityCode: 'LEARN',
            activity: { name: 'Learn', code: 'LEARN' },
            status: 'APPROVED',
            visibility: 'PUBLIC',
            payload: {
              activityCode: 'LEARN',
              data: {
                provider: 'SPL',
                course_name: 'AI for Educators',
                completed_at: new Date().toISOString(),
                certificate_file: 'evidence/learn/user123/certificate.pdf',
              },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }
    expect(() => ProfileResponseSchema.parse(sample)).not.toThrow()
  })

  it('validates example admin users response', () => {
    const sample = {
      success: true,
      data: {
        users: [
          {
            id: 'user_1',
            handle: 'educator',
            name: 'User',
            email: 'u@example.com',
            avatar_url: null,
            role: 'PARTICIPANT',
            school: null,
            cohort: null,
            created_at: new Date().toISOString(),
            _count: { submissions: 1, earned_badges: 0, ledger: 1 },
            totalPoints: 20,
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    }
    expect(() => AdminUsersListResponseSchema.parse(sample)).not.toThrow()
  })
})
