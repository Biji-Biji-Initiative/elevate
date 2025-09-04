import { describe, it, expect } from 'vitest'
import {
  mapLeaderboardUserBadgeToDTO,
  mapLeaderboardEntryToDTO,
  mapSubmissionToDTO,
  mapUserProfileBadgeToDTO,
  mapUserProfileToDTO,
  mapRawLeaderboardEntryToDTO,
  mapRawUserProfileToDTO,
  extractPointsFromAggregation,
  type User,
  type Submission,
  type Activity,
  type Badge,
  type EarnedBadge,
  type PrismaAggregationResult,
  type LeaderboardEntryDTO,
  type UserProfileDTO,
  type SubmissionDTO,
  type StageBreakdownDTO,
  type StatsResponseDTO
} from '../dto-mappers.js'

// Mock data for testing
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  handle: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  role: 'PARTICIPANT',
  school: 'Test School',
  cohort: 'Cohort 2024',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  is_public: true,
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
  ...overrides
})

const createMockActivity = (overrides: Partial<Activity> = {}): Activity => ({
  code: 'LEARN',
  name: 'Learn Activity',
  description: 'Learning phase of LEAPS',
  default_points: 20,
  requirements: { type: 'certificate' },
  is_active: true,
  sort_order: 1,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides
})

const createMockBadge = (overrides: Partial<Badge> = {}): Badge => ({
  code: 'EARLY_ADOPTER',
  name: 'Early Adopter',
  description: 'First to complete LEARN stage',
  icon_url: 'https://example.com/badge.png',
  criteria: { early_completion: true },
  is_active: true,
  sort_order: 1,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides
})

const createMockSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 'submission-123',
  user_id: 'user-123',
  activity_code: 'LEARN',
  status: 'APPROVED',
  visibility: 'PUBLIC',
  payload: { certificate_url: 'https://example.com/cert.pdf' },
  attachments: ['file1.pdf', 'file2.jpg'],
  reviewer_id: 'reviewer-456',
  admin_notes: 'Approved automatically',
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T12:00:00Z'),
  ...overrides
})

const createMockEarnedBadge = (overrides: Partial<EarnedBadge> = {}): EarnedBadge => ({
  id: 'earned-badge-123',
  user_id: 'user-123',
  badge_code: 'EARLY_ADOPTER',
  earned_at: new Date('2024-01-15T11:00:00Z'),
  created_at: new Date('2024-01-15T11:00:00Z'),
  ...overrides
})

describe('DTO Mappers - ORM Leakage Prevention', () => {
  describe('Snake case to camelCase conversion', () => {
    it('should convert snake_case fields to camelCase in LeaderboardEntryDTO', () => {
      const user = createMockUser()
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()

      const dto = mapLeaderboardEntryToDTO(
        1,
        { ...user, earned_badges: [{ ...earnedBadge, badge }] },
        100
      )

      // Should use camelCase
      expect(dto.user.avatarUrl).toBe(user.avatar_url)
      expect(dto.user.totalPoints).toBe(100)
      
      // Should not leak snake_case fields
      expect('avatar_url' in dto.user).toBe(false)
      expect('earned_badges' in dto.user).toBe(false)
    })

    it('should convert snake_case fields to camelCase in SubmissionDTO', () => {
      const submission = createMockSubmission()
      const activity = createMockActivity()

      const dto = mapSubmissionToDTO({ ...submission, activity })

      // Should use camelCase
      expect(dto.activityCode).toBe(submission.activity_code)
      expect(dto.createdAt).toBe(submission.created_at.toISOString())
      expect(dto.updatedAt).toBe(submission.updated_at.toISOString())
      
      // Should not leak snake_case fields
      expect('activity_code' in dto).toBe(false)
      expect('created_at' in dto).toBe(false)
      expect('updated_at' in dto).toBe(false)
    })

    it('should convert snake_case fields in UserProfileDTO', () => {
      const user = createMockUser()
      const submission = createMockSubmission()
      const activity = createMockActivity()
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()

      const dto = mapUserProfileToDTO(
        {
          ...user,
          submissions: [{ ...submission, activity }],
          earned_badges: [{ ...earnedBadge, badge }]
        },
        150
      )

      // Should use camelCase
      expect(dto.avatarUrl).toBe(user.avatar_url)
      expect(dto.createdAt).toBe(user.created_at.toISOString())
      expect(dto.totalPoints).toBe(150)
      
      // Should not leak snake_case fields
      expect('avatar_url' in dto).toBe(false)
      expect('created_at' in dto).toBe(false)
      expect('earned_badges' in dto).toBe(false)
    })
  })

  describe('Badge mapping with snake_case to camelCase', () => {
    it('should convert badge icon_url to iconUrl', () => {
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()

      const dto = mapLeaderboardUserBadgeToDTO({ ...earnedBadge, badge })

      expect(dto.badge.iconUrl).toBe(badge.icon_url)
      expect('icon_url' in dto.badge).toBe(false)
    })

    it('should handle null icon_url properly', () => {
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge({ icon_url: null })

      const dto = mapLeaderboardUserBadgeToDTO({ ...earnedBadge, badge })

      expect(dto.badge.iconUrl).toBe(null)
    })

    it('should convert earnedAt from earned_at', () => {
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()

      const dto = mapUserProfileBadgeToDTO({ ...earnedBadge, badge })

      expect(dto.earnedAt).toBe(earnedBadge.earned_at.toISOString())
      expect('earned_at' in dto).toBe(false)
    })
  })

  describe('Remove Prisma-specific _sum fields', () => {
    it('should extract points from Prisma aggregation safely', () => {
      // Valid aggregation result
      const validAggregation: PrismaAggregationResult = {
        _sum: { points: 150 }
      }
      expect(extractPointsFromAggregation(validAggregation)).toBe(150)

      // Null points
      const nullPointsAggregation: PrismaAggregationResult = {
        _sum: { points: null }
      }
      expect(extractPointsFromAggregation(nullPointsAggregation)).toBe(0)

      // Missing _sum
      const noSumAggregation: PrismaAggregationResult = {}
      expect(extractPointsFromAggregation(noSumAggregation)).toBe(0)

      // Null aggregation
      expect(extractPointsFromAggregation(null)).toBe(0)
      expect(extractPointsFromAggregation(undefined)).toBe(0)
    })

    it('should map raw leaderboard data without exposing _sum structure', () => {
      const rawUser = {
        id: 'user-123',
        handle: 'testuser',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        school: 'Test School',
        earned_badges: [
          {
            badge: {
              code: 'EARLY_ADOPTER',
              name: 'Early Adopter',
              icon_url: 'https://example.com/badge.png'
            }
          }
        ],
        _sum: {
          points: 200
        }
      }

      const dto = mapRawLeaderboardEntryToDTO(1, rawUser)

      expect(dto.user.totalPoints).toBe(200)
      expect('_sum' in dto.user).toBe(false)
      expect(dto.user.avatarUrl).toBe(rawUser.avatar_url)
      expect('avatar_url' in dto.user).toBe(false)
    })

    it('should map raw user profile without exposing internal structure', () => {
      const rawUser = {
        id: 'user-123',
        handle: 'testuser',
        name: 'Test User',
        school: 'Test School',
        cohort: 'Cohort 2024',
        created_at: new Date('2024-01-15T10:00:00Z'),
        _sum: { points: 300 },
        earned_badges: [
          {
            badge: {
              code: 'EXPERT',
              name: 'Expert Badge',
              description: 'Expert level achievement',
              icon_url: 'https://example.com/expert.png'
            },
            earned_at: new Date('2024-01-15T11:00:00Z')
          }
        ],
        submissions: [
          {
            id: 'sub-123',
            activity_code: 'LEARN',
            activity: { name: 'Learn Activity', code: 'LEARN' },
            status: 'APPROVED',
            visibility: 'PUBLIC',
            payload: { test: 'data' },
            created_at: new Date('2024-01-15T10:30:00Z'),
            updated_at: new Date('2024-01-15T10:30:00Z')
          }
        ]
      }

      const dto = mapRawUserProfileToDTO(rawUser)

      expect(dto.totalPoints).toBe(300)
      expect('_sum' in dto).toBe(false)
      expect(dto.createdAt).toBe(rawUser.created_at.toISOString())
      expect('created_at' in dto).toBe(false)
      expect(dto.earnedBadges[0].badge.iconUrl).toBe(rawUser.earned_badges[0].badge.icon_url)
      expect('icon_url' in dto.earnedBadges[0].badge).toBe(false)
    })
  })

  describe('Clean field mapping without ORM artifacts', () => {
    it('should only include clean API fields in LeaderboardEntryDTO', () => {
      const user = createMockUser()
      const dto = mapLeaderboardEntryToDTO(1, user, 100)

      // Should have clean API fields
      const expectedFields = ['rank', 'user']
      const userExpectedFields = ['id', 'handle', 'name', 'school', 'avatarUrl', 'earnedBadges', 'totalPoints']

      expect(Object.keys(dto)).toEqual(expectedFields)
      expect(Object.keys(dto.user).sort()).toEqual(userExpectedFields.sort())

      // Should not have internal ORM fields
      expect('created_at' in dto.user).toBe(false)
      expect('updated_at' in dto.user).toBe(false)
      expect('is_public' in dto.user).toBe(false)
      expect('email' in dto.user).toBe(false) // Private field excluded
    })

    it('should only include clean API fields in SubmissionDTO', () => {
      const submission = createMockSubmission()
      const activity = createMockActivity()
      const dto = mapSubmissionToDTO({ ...submission, activity })

      const expectedFields = ['id', 'activityCode', 'activity', 'status', 'visibility', 'payload', 'createdAt', 'updatedAt']
      expect(Object.keys(dto).sort()).toEqual(expectedFields.sort())

      // Should not have internal fields
      expect('user_id' in dto).toBe(false)
      expect('reviewer_id' in dto).toBe(false)
      expect('admin_notes' in dto).toBe(false)
      expect('attachments' in dto).toBe(false)
    })

    it('should properly handle undefined/null values', () => {
      const user = createMockUser({
        avatar_url: null,
        school: null,
        bio: null
      })
      const dto = mapLeaderboardEntryToDTO(1, user, 50)

      expect(dto.user.avatarUrl).toBeUndefined()
      expect(dto.user.school).toBeUndefined()
      // bio is not included in leaderboard DTO, so no test needed
    })

    it('should handle optional earned badges properly', () => {
      const user = createMockUser()
      
      // Test with no badges
      const dtoNoBadges = mapLeaderboardEntryToDTO(1, user, 50)
      expect(dtoNoBadges.user.earnedBadges).toBeUndefined()

      // Test with empty badges array - mapping returns empty array
      const dtoEmptyBadges = mapLeaderboardEntryToDTO(1, { ...user, earned_badges: [] }, 50)
      expect(dtoEmptyBadges.user.earnedBadges).toEqual([])

      // Test with badges
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()
      const dtoWithBadges = mapLeaderboardEntryToDTO(
        1, 
        { ...user, earned_badges: [{ ...earnedBadge, badge }] }, 
        50
      )
      expect(dtoWithBadges.user.earnedBadges).toHaveLength(1)
    })
  })

  describe('Date handling and ISO string conversion', () => {
    it('should convert Date objects to ISO strings', () => {
      const testDate = new Date('2024-01-15T10:30:45.123Z')
      const submission = createMockSubmission({
        created_at: testDate,
        updated_at: testDate
      })
      const activity = createMockActivity()
      
      const dto = mapSubmissionToDTO({ ...submission, activity })

      expect(dto.createdAt).toBe(testDate.toISOString())
      expect(dto.updatedAt).toBe(testDate.toISOString())
      expect(typeof dto.createdAt).toBe('string')
      expect(typeof dto.updatedAt).toBe('string')
    })

    it('should handle string dates in raw mapping functions', () => {
      const rawUser = {
        id: 'user-123',
        handle: 'testuser',
        name: 'Test User',
        created_at: '2024-01-15T10:30:45.123Z', // Already a string
        _sum: { points: 100 },
        earned_badges: [],
        submissions: []
      }

      const dto = mapRawUserProfileToDTO(rawUser)

      expect(dto.createdAt).toBe('2024-01-15T10:30:45.123Z')
      expect(typeof dto.createdAt).toBe('string')
    })

    it('should handle Date objects in raw mapping functions', () => {
      const testDate = new Date('2024-01-15T10:30:45.123Z')
      const rawUser = {
        id: 'user-123',
        handle: 'testuser',
        name: 'Test User',
        created_at: testDate, // Date object
        _sum: { points: 100 },
        earned_badges: [],
        submissions: []
      }

      const dto = mapRawUserProfileToDTO(rawUser)

      expect(dto.createdAt).toBe(testDate.toISOString())
      expect(typeof dto.createdAt).toBe('string')
    })
  })

  describe('Type safety and proper DTO structure', () => {
    it('should maintain proper DTO type structure for LeaderboardEntryDTO', () => {
      const user = createMockUser()
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()
      
      const dto: LeaderboardEntryDTO = mapLeaderboardEntryToDTO(
        5,
        { ...user, earned_badges: [{ ...earnedBadge, badge }] },
        250
      )

      // Type assertions to ensure proper structure
      expect(typeof dto.rank).toBe('number')
      expect(typeof dto.user.id).toBe('string')
      expect(typeof dto.user.handle).toBe('string')
      expect(typeof dto.user.name).toBe('string')
      expect(typeof dto.user.totalPoints).toBe('number')
      
      if (dto.user.earnedBadges) {
        expect(Array.isArray(dto.user.earnedBadges)).toBe(true)
        expect(typeof dto.user.earnedBadges[0].badge.code).toBe('string')
      }
    })

    it('should maintain proper DTO type structure for UserProfileDTO', () => {
      const user = createMockUser()
      const submission = createMockSubmission()
      const activity = createMockActivity()
      const earnedBadge = createMockEarnedBadge()
      const badge = createMockBadge()

      const dto: UserProfileDTO = mapUserProfileToDTO(
        {
          ...user,
          submissions: [{ ...submission, activity }],
          earned_badges: [{ ...earnedBadge, badge }]
        },
        300
      )

      // Type assertions
      expect(typeof dto.id).toBe('string')
      expect(typeof dto.handle).toBe('string')
      expect(typeof dto.name).toBe('string')
      expect(typeof dto.email).toBe('string')
      expect(typeof dto.totalPoints).toBe('number')
      expect(typeof dto.createdAt).toBe('string')
      
      expect(Array.isArray(dto.submissions)).toBe(true)
      expect(Array.isArray(dto.earnedBadges)).toBe(true)
      
      if (dto.submissions.length > 0) {
        const submissionDto: SubmissionDTO = dto.submissions[0]
        expect(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']).toContain(submissionDto.activityCode)
        expect(['PENDING', 'APPROVED', 'REJECTED']).toContain(submissionDto.status)
        expect(['PUBLIC', 'PRIVATE']).toContain(submissionDto.visibility)
      }
    })

    it('should handle payload type safety', () => {
      const submission = createMockSubmission({
        payload: {
          certificate_url: 'https://example.com/cert.pdf',
          notes: 'Completed course',
          score: 95
        }
      })
      const activity = createMockActivity()
      
      const dto = mapSubmissionToDTO({ ...submission, activity })

      // Payload should be typed as Record<string, unknown>
      expect(typeof dto.payload).toBe('object')
      expect(dto.payload).toEqual(submission.payload)
      
      // Should maintain structure but be properly typed
      const payload = dto.payload as Record<string, unknown>
      expect(payload.certificate_url).toBe('https://example.com/cert.pdf')
      expect(payload.notes).toBe('Completed course')
      expect(payload.score).toBe(95)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle missing optional fields gracefully', () => {
      const minimalUser = createMockUser({
        avatar_url: null,
        school: null,
        bio: null
      })

      const dto = mapLeaderboardEntryToDTO(1, minimalUser, 0)

      expect(dto.user.avatarUrl).toBeUndefined()
      expect(dto.user.school).toBeUndefined()
      expect(dto.user.totalPoints).toBe(0)
    })

    it('should handle empty arrays properly', () => {
      const user = createMockUser()
      const userProfile = mapUserProfileToDTO(
        {
          ...user,
          submissions: [],
          earned_badges: []
        },
        0
      )

      expect(userProfile.submissions).toEqual([])
      expect(userProfile.earnedBadges).toEqual([])
    })

    it('should preserve null vs undefined semantics', () => {
      const rawUserWithNulls = {
        id: 'user-123',
        handle: 'testuser',
        name: 'Test User',
        school: null,
        cohort: null,
        created_at: new Date(),
        _sum: { points: 0 },
        earned_badges: [],
        submissions: []
      }

      const dto = mapRawUserProfileToDTO(rawUserWithNulls)

      // Null values should become undefined in DTOs for clean API
      expect(dto.school).toBeUndefined()
      expect(dto.cohort).toBeUndefined()
    })

    it('should handle activity code type safety', () => {
      const validActivityCodes = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'] as const
      
      validActivityCodes.forEach(code => {
        const submission = createMockSubmission({ activity_code: code })
        const activity = createMockActivity({ code })
        const dto = mapSubmissionToDTO({ ...submission, activity })

        expect(dto.activityCode).toBe(code)
        expect(validActivityCodes).toContain(dto.activityCode)
      })
    })
  })
})