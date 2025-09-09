import { describe, it, expect } from 'vitest'
import { openApiSpec } from '../spec'
import {
  PlatformStatsResponseSchema,
  StageMetricsResponseSchema,
  ProfileResponseSchema,
  AdminUsersListResponseSchema,
} from '../schemas'

describe('OpenAPI contract', () => {
  it('includes public endpoints', () => {
    const paths = openApiSpec.paths || {}
    expect(paths['/api/stats']).toBeDefined()
    expect(paths['/api/metrics']).toBeDefined()
    expect(paths['/api/profile/{handle}']).toBeDefined()
  })

  it('validates example platform stats', () => {
    const sample = {
      success: true,
      data: {
        counters: {
          educators_learning: 10,
          peers_students_reached: 20,
          stories_shared: 5,
          micro_credentials: 15,
          mce_certified: 0,
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
            badge: { code: 'FIRST', name: 'First', description: 'desc', iconUrl: null },
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
            id: 'user_1', handle: 'educator', name: 'User', email: 'u@example.com', avatar_url: null,
            role: 'PARTICIPANT', school: null, cohort: null, created_at: new Date().toISOString(),
            _count: { submissions: 1, earned_badges: 0, ledger: 1 }, totalPoints: 20,
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    }
    expect(() => AdminUsersListResponseSchema.parse(sample)).not.toThrow()
  })
})
