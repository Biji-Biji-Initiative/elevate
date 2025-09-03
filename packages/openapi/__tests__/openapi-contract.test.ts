import { describe, it, expect } from 'vitest'
import { openApiSpec } from '../src/spec'
import {
  PlatformStatsResponseSchema,
  StageMetricsResponseSchema,
  ProfileResponseSchema,
  AdminUsersListResponseSchema,
} from '../src/schemas'

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
        totalEducators: 100,
        totalSubmissions: 200,
        totalPoints: 5000,
        studentsImpacted: 1200,
        byStage: {
          LEARN: { total: 50, approved: 40, pending: 5, rejected: 5 },
          EXPLORE: { total: 60, approved: 50, pending: 5, rejected: 5 },
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
        created_at: new Date().toISOString(),
        _sum: { points: 100 },
        earned_badges: [
          { earned_at: new Date().toISOString(), badge: { code: 'FIRST', name: 'First', description: 'desc', icon_url: null } },
        ],
        submissions: [
          {
            id: 'sub_1',
            activity_code: 'LEARN',
            activity: { name: 'Learn', code: 'LEARN' },
            status: 'APPROVED',
            visibility: 'PUBLIC',
            payload: {},
            created_at: new Date().toISOString(),
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

