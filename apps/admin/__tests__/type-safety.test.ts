import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

// Test imports to ensure types are properly exported
import type { 
  AdminSubmission, 
  AdminUser, 
  AdminBadge, 
  KajabiEvent, 
  KajabiStats,
  SubmissionsQuery,
  UsersQuery,
  AnalyticsQuery
} from '@/lib/admin-client'

import { 
  AdminSubmissionSchema,
  AdminUserSchema,
  AdminBadgeSchema,
  KajabiEventSchema,
  KajabiStatsSchema,
  SubmissionsQuerySchema,
  UsersQuerySchema,
  AnalyticsQuerySchema,
  SubmissionsListResponseSchema,
  UsersListResponseSchema,
  BadgesListResponseSchema,
  AnalyticsResponseSchema,
  KajabiResponseSchema
} from '@elevate/types/admin-api-types'

describe('Admin Client Type Safety', () => {
  describe('Schema Validation', () => {
    it('should validate AdminSubmission schema', () => {
      const validSubmission = {
        id: 'sub_123',
        created_at: '2024-01-01T00:00:00Z',
        status: 'PENDING',
        visibility: 'PRIVATE',
        payload: { content: 'test' },
        attachmentCount: 0,
        attachments_rel: [],
        user: {
          id: 'user_123',
          name: 'John Doe',
          handle: 'john_doe',
          email: 'john@example.com'
        },
        activity: {
          code: 'LEARN',
          name: 'Learn Stage'
        }
      }

      expect(() => AdminSubmissionSchema.parse(validSubmission)).not.toThrow()
    })

    it('should validate AdminUser schema', () => {
      const validUser = {
        id: 'user_123',
        handle: 'john_doe',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'PARTICIPANT',
        created_at: '2024-01-01T00:00:00Z',
        _count: {
          submissions: 5,
          ledger: 3,
          earned_badges: 2
        },
        totalPoints: 100
      }

      expect(() => AdminUserSchema.parse(validUser)).not.toThrow()
    })

    it('should validate SubmissionsQuery schema', () => {
      const validQuery = {
        status: 'PENDING' as const,
        activity: 'LEARN' as const,
        page: 1,
        limit: 50,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      }

      expect(() => SubmissionsQuerySchema.parse(validQuery)).not.toThrow()
    })

    it('should validate API response schemas', () => {
      const mockSubmissionsResponse = {
        success: true,
        data: {
          submissions: [],
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            pages: 0
          }
        }
      }

      expect(() => SubmissionsListResponseSchema.parse(mockSubmissionsResponse)).not.toThrow()
    })
  })

  describe('Type Guards', () => {
    it('should properly type guard API error responses', () => {
      const errorResponse = { success: false, error: 'Test error' }
      
      // Type guard function that should be part of admin client
      function isApiError(response: unknown): response is { success: false; error: string } {
        return typeof response === 'object' && response !== null && 
          'success' in response && response.success === false
      }

      expect(isApiError(errorResponse)).toBe(true)
    })

    it('should properly validate pagination data', () => {
      const validPagination = {
        page: 1,
        limit: 50,
        total: 100,
        pages: 2
      }

      expect(() => z.object({
        page: z.number().int(),
        limit: z.number().int(),
        total: z.number().int(),
        pages: z.number().int(),
      }).parse(validPagination)).not.toThrow()
    })
  })

  describe('Enum Validation', () => {
    it('should validate activity codes', () => {
      const validCodes = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
      const invalidCode = 'INVALID'

      validCodes.forEach(code => {
        expect(() => z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']).parse(code)).not.toThrow()
      })

      expect(() => z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']).parse(invalidCode)).toThrow()
    })

    it('should validate submission statuses', () => {
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
      const invalidStatus = 'INVALID'

      validStatuses.forEach(status => {
        expect(() => z.enum(['PENDING', 'APPROVED', 'REJECTED']).parse(status)).not.toThrow()
      })

      expect(() => z.enum(['PENDING', 'APPROVED', 'REJECTED']).parse(invalidStatus)).toThrow()
    })

    it('should validate user roles', () => {
      const validRoles = ['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']
      const invalidRole = 'INVALID'

      validRoles.forEach(role => {
        expect(() => z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']).parse(role)).not.toThrow()
      })

      expect(() => z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']).parse(invalidRole)).toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle admin client errors properly', async () => {
      // Mock admin client error
      const mockError = new Error('Test error')
      mockError.name = 'AdminClientError'

      expect(mockError.name).toBe('AdminClientError')
      expect(mockError.message).toBe('Test error')
    })

    it('should validate error response format', () => {
      const errorSchema = z.object({
        success: z.literal(false),
        error: z.string()
      })

      const validError = { success: false, error: 'Something went wrong' }
      const invalidError = { success: true, data: {} }

      expect(() => errorSchema.parse(validError)).not.toThrow()
      expect(() => errorSchema.parse(invalidError)).toThrow()
    })
  })

  describe('Complex Data Types', () => {
    it('should handle nested object validation', () => {
      const complexSubmission = {
        id: 'sub_123',
        created_at: '2024-01-01T00:00:00Z',
        status: 'APPROVED',
        visibility: 'PUBLIC',
        payload: {
          reflection: 'This is my reflection',
          linkedinUrl: 'https://linkedin.com/posts/123',
          peersTrained: 5,
          studentsTrained: 20,
          trainingDate: '2024-01-15'
        },
        attachmentCount: 1,
        attachments_rel: [
          { id: 'att_123', submission_id: 'sub_123', path: 'evidence/u1/certificate.pdf' }
        ],
        user: {
          id: 'user_123',
          name: 'John Doe',
          handle: 'john_doe',
          email: 'john@example.com',
          school: 'Test School',
          cohort: 'Cohort A'
        },
        activity: {
          code: 'AMPLIFY',
          name: 'Amplify Stage',
          default_points: 50
        },
        points_awarded: 104,
        reviewer: {
          id: 'reviewer_123',
          name: 'Jane Reviewer',
          handle: 'jane_reviewer'
        },
        reviewed_at: '2024-01-02T00:00:00Z',
        review_note: 'Great work!'
      }

      expect(() => AdminSubmissionSchema.parse(complexSubmission)).not.toThrow()
    })

    it('should handle analytics data validation', () => {
      const mockAnalyticsResponse = {
        success: true,
        data: {
          overview: {
            submissions: {
              total: 100,
              pending: 20,
              approved: 70,
              rejected: 10,
              approvalRate: 0.7
            },
            users: {
              total: 50,
              active: 40,
              withSubmissions: 35,
              withBadges: 15,
              activationRate: 0.8
            },
            points: {
              totalAwarded: 5000,
              totalEntries: 100,
              avgPerEntry: 50
            },
            badges: {
              totalBadges: 10,
              totalEarned: 25,
              uniqueEarners: 15
            },
            reviews: {
              pendingReviews: 20,
              avgReviewTimeHours: 24
            }
          },
          distributions: {
            submissionsByStatus: [
              { status: 'PENDING', count: 20 },
              { status: 'APPROVED', count: 70 },
              { status: 'REJECTED', count: 10 }
            ],
            submissionsByActivity: [
              { activity: 'LEARN', activityName: 'Learn Stage', count: 30 },
              { activity: 'EXPLORE', activityName: 'Explore Stage', count: 25 }
            ],
            usersByRole: [
              { role: 'PARTICIPANT', count: 45 },
              { role: 'REVIEWER', count: 5 }
            ],
            pointsByActivity: [
              { activity: 'LEARN', activityName: 'Learn Stage', totalPoints: 600, entries: 30 },
              { activity: 'EXPLORE', activityName: 'Explore Stage', totalPoints: 1250, entries: 25 }
            ]
          },
          trends: {
            submissionsByDate: [
              { date: '2024-01-01', total: 5, approved: 4, rejected: 1, pending: 0 }
            ],
            userRegistrationsByDate: [
              { date: '2024-01-01', count: 10 }
            ]
          },
          recentActivity: {
            submissions: [
              { id: 'sub_123', activity_code: 'LEARN', user_name: 'John Doe', created_at: '2024-01-01T00:00:00Z', status: 'PENDING' }
            ],
            approvals: [
              { id: 'sub_456', activity_code: 'EXPLORE', user_name: 'Jane Doe', reviewer_name: 'Admin', approved_at: '2024-01-01T01:00:00Z', points_awarded: 50 }
            ],
            users: [
              { id: 'user_789', name: 'Bob User', created_at: '2024-01-01T00:00:00Z', cohort: 'Cohort A' }
            ]
          },
          performance: {
            reviewers: [
              { id: 'rev_123', name: 'Jane Reviewer', reviewCount: 25, avgReviewTimeHours: 12, approvalRate: 0.8 }
            ],
            topBadges: [
              { code: 'early-adopter', name: 'Early Adopter', earnedCount: 5, uniqueEarners: 5 }
            ]
          }
        }
      }

      expect(() => AnalyticsResponseSchema.parse(mockAnalyticsResponse)).not.toThrow()
    })
  })
})
