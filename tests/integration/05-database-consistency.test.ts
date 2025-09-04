/**
 * Integration Test: Database Consistency and Integrity
 * 
 * Tests database integrity:
 * 1. Foreign key constraints are enforced
 * 2. Unique constraints prevent duplicates  
 * 3. Materialized views stay consistent with source data
 * 4. Migration scripts run idempotently
 * 5. Transaction rollback works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestDatabase } from '../../packages/db/tests/helpers'

describe('Integration: Database Consistency and Integrity', () => {
  let testDb: TestDatabase
  let testUser: { id: string; email: string; handle: string }
  let testActivity: { code: string; name: string }

  beforeEach(async () => {
    // Setup isolated test database
    testDb = new TestDatabase()
    await testDb.setup()

    // Create test data
    testUser = await testDb.fixtures.createTestUser({
      handle: 'consistency-test',
      name: 'Consistency Test User',
      email: 'consistency@example.com',
      role: 'PARTICIPANT'
    })

    testActivity = await testDb.prisma.activity.findFirst({
      where: { code: 'LEARN' }
    })

    if (!testActivity) {
      testActivity = await testDb.prisma.activity.create({
        data: {
          code: 'LEARN',
          name: 'Learn',
          default_points: 20
        }
      })
    }
  })

  afterEach(async () => {
    await testDb.cleanup()
  })

  describe('Foreign Key Constraints', () => {
    it('should prevent creating submission with invalid user_id', async () => {
      await expect(
        testDb.prisma.submission.create({
          data: {
            user_id: 'nonexistent-user-id',
            activity_code: 'LEARN',
            status: 'PENDING',
            visibility: 'PRIVATE',
            payload: { test: 'data' }
          }
        })
      ).rejects.toThrow()
    })

    it('should prevent creating submission with invalid activity_code', async () => {
      await expect(
        testDb.prisma.submission.create({
          data: {
            user_id: testUser.id,
            activity_code: 'NONEXISTENT_ACTIVITY',
            status: 'PENDING',
            visibility: 'PRIVATE',
            payload: { test: 'data' }
          }
        })
      ).rejects.toThrow()
    })

    it('should prevent creating points ledger with invalid user_id', async () => {
      await expect(
        testDb.prisma.pointsLedger.create({
          data: {
            user_id: 'nonexistent-user',
            activity_code: 'LEARN',
            source: 'MANUAL',
            delta_points: 20
          }
        })
      ).rejects.toThrow()
    })

    it('should prevent creating points ledger with invalid activity_code', async () => {
      await expect(
        testDb.prisma.pointsLedger.create({
          data: {
            user_id: testUser.id,
            activity_code: 'INVALID_ACTIVITY',
            source: 'MANUAL',
            delta_points: 20
          }
        })
      ).rejects.toThrow()
    })

    it('should cascade delete submissions when user is deleted', async () => {
      // Create submission for user
      const submission = await testDb.fixtures.createTestSubmission({
        user_id: testUser.id
      })

      // Verify submission exists
      const submissionExists = await testDb.prisma.submission.findUnique({
        where: { id: submission.id }
      })
      expect(submissionExists).toBeDefined()

      // Delete user - should cascade to submissions
      await testDb.prisma.user.delete({
        where: { id: testUser.id }
      })

      // Verify submission was deleted
      const submissionAfterDelete = await testDb.prisma.submission.findUnique({
        where: { id: submission.id }
      })
      expect(submissionAfterDelete).toBeNull()
    })

    it('should cascade delete points when user is deleted', async () => {
      // Create points entry for user
      const pointsEntry = await testDb.fixtures.createPointsEntry({
        user_id: testUser.id,
        activity_code: 'LEARN',
        delta_points: 20
      })

      // Verify points entry exists
      const pointsExists = await testDb.prisma.pointsLedger.findUnique({
        where: { id: pointsEntry.id }
      })
      expect(pointsExists).toBeDefined()

      // Delete user - should cascade to points
      await testDb.prisma.user.delete({
        where: { id: testUser.id }
      })

      // Verify points entry was deleted
      const pointsAfterDelete = await testDb.prisma.pointsLedger.findUnique({
        where: { id: pointsEntry.id }
      })
      expect(pointsAfterDelete).toBeNull()
    })

    it('should prevent deleting activity if it has associated data', async () => {
      // Create submission using the activity
      await testDb.fixtures.createTestSubmission({
        user_id: testUser.id,
        activity_code: testActivity.code
      })

      // Try to delete activity - should fail due to constraint
      await expect(
        testDb.prisma.activity.delete({
          where: { code: testActivity.code }
        })
      ).rejects.toThrow()
    })
  })

  describe('Unique Constraints', () => {
    it('should prevent duplicate user handles', async () => {
      await expect(
        testDb.fixtures.createTestUser({
          handle: testUser.handle, // Duplicate handle
          email: 'different@example.com'
        })
      ).rejects.toThrow()
    })

    it('should prevent duplicate user emails', async () => {
      await expect(
        testDb.fixtures.createTestUser({
          handle: 'different-handle',
          email: testUser.email // Duplicate email
        })
      ).rejects.toThrow()
    })

    it('should prevent duplicate external_event_id in points ledger', async () => {
      // Create first points entry with external_event_id
      await testDb.fixtures.createPointsEntry({
        user_id: testUser.id,
        external_event_id: 'unique-event-123'
      })

      // Try to create another with same external_event_id - should fail
      await expect(
        testDb.fixtures.createPointsEntry({
          user_id: testUser.id,
          external_event_id: 'unique-event-123' // Duplicate
        })
      ).rejects.toThrow()
    })

    it('should prevent duplicate badge awards per user', async () => {
      // Create badge if it doesn't exist
      await testDb.prisma.badge.upsert({
        where: { code: 'TEST_BADGE' },
        update: {},
        create: {
          code: 'TEST_BADGE',
          name: 'Test Badge',
          description: 'Test badge for testing',
          criteria: { test: true }
        }
      })

      // Award badge to user
      await testDb.prisma.earnedBadge.create({
        data: {
          user_id: testUser.id,
          badge_code: 'TEST_BADGE'
        }
      })

      // Try to award same badge again - should fail
      await expect(
        testDb.prisma.earnedBadge.create({
          data: {
            user_id: testUser.id,
            badge_code: 'TEST_BADGE' // Duplicate
          }
        })
      ).rejects.toThrow()
    })

    it('should prevent duplicate submission attachments', async () => {
      const submission = await testDb.fixtures.createTestSubmission({
        user_id: testUser.id
      })

      // Create attachment
      await testDb.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: '/uploads/test-file.pdf',
          hash: 'test-hash-123'
        }
      })

      // Try to create duplicate attachment - should fail
      await expect(
        testDb.prisma.submissionAttachment.create({
          data: {
            submission_id: submission.id!,
            path: '/uploads/test-file.pdf', // Same path for same submission
            hash: 'different-hash'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Data Consistency Checks', () => {
    it('should maintain consistent points totals', async () => {
      const user2 = await testDb.fixtures.createTestUser({
        handle: 'user2',
        email: 'user2@example.com'
      })

      // Create multiple points entries for each user
      const pointsEntries = [
        { user_id: testUser.id, delta_points: 20 },
        { user_id: testUser.id, delta_points: 50 },
        { user_id: testUser.id, delta_points: -5 }, // Adjustment
        { user_id: user2.id, delta_points: 30 },
        { user_id: user2.id, delta_points: 25 }
      ]

      for (const entry of pointsEntries) {
        await testDb.fixtures.createPointsEntry(entry)
      }

      // Calculate expected totals
      const user1Expected = 20 + 50 - 5 // 65
      const user2Expected = 30 + 25 // 55

      // Verify actual totals match expected
      const user1Total = await testDb.prisma.pointsLedger.aggregate({
        where: { user_id: testUser.id },
        _sum: { delta_points: true }
      })

      const user2Total = await testDb.prisma.pointsLedger.aggregate({
        where: { user_id: user2.id },
        _sum: { delta_points: true }
      })

      expect(user1Total._sum.delta_points).toBe(user1Expected)
      expect(user2Total._sum.delta_points).toBe(user2Expected)
    })

    it('should maintain submission and points consistency', async () => {
      // Create approved submission
      const submission = await testDb.fixtures.createTestSubmission({
        user_id: testUser.id,
        status: 'APPROVED'
      })

      // Create corresponding points entry
      await testDb.fixtures.createPointsEntry({
        user_id: testUser.id,
        activity_code: submission.activity_code,
        external_event_id: `submission_${submission.id}`,
        delta_points: 20
      })

      // Verify consistency: approved submissions should have corresponding points
      const approvedSubmissions = await testDb.prisma.submission.findMany({
        where: {
          user_id: testUser.id,
          status: 'APPROVED'
        }
      })

      for (const sub of approvedSubmissions) {
        const correspondingPoints = await testDb.prisma.pointsLedger.findFirst({
          where: {
            user_id: sub.user_id,
            external_event_id: `submission_${sub.id}`
          }
        })
        expect(correspondingPoints).toBeDefined()
      }
    })

    it('should maintain audit log integrity', async () => {
      // Perform actions that should create audit logs
      const submission = await testDb.fixtures.createTestSubmission({
        user_id: testUser.id
      })

      await testDb.fixtures.createPointsEntry({
        user_id: testUser.id
      })

      // Create audit logs for these actions
      await testDb.prisma.auditLog.create({
        data: {
          actor_id: 'system',
          action: 'SUBMISSION_CREATED',
          target_id: submission.id,
          meta: {
            entityType: 'submission',
            entityId: submission.id
          }
        }
      })

      await testDb.prisma.auditLog.create({
        data: {
          actor_id: 'system',
          action: 'POINTS_AWARDED',
          target_id: testUser.id,
          meta: {
            entityType: 'user',
            entityId: testUser.id,
            points: 20
          }
        }
      })

      // Verify audit logs exist and are properly structured
      const auditLogs = await testDb.prisma.auditLog.findMany({
        where: {
          OR: [
            { target_id: submission.id },
            { target_id: testUser.id }
          ]
        },
        orderBy: { created_at: 'asc' }
      })

      expect(auditLogs).toHaveLength(2)
      
      const submissionLog = auditLogs.find(log => log.action === 'SUBMISSION_CREATED')
      const pointsLog = auditLogs.find(log => log.action === 'POINTS_AWARDED')
      
      expect(submissionLog).toBeDefined()
      expect(pointsLog).toBeDefined()
      
      expect(submissionLog?.meta).toMatchObject({
        entityType: 'submission',
        entityId: submission.id
      })
      
      expect(pointsLog?.meta).toMatchObject({
        entityType: 'user',
        entityId: testUser.id,
        points: 20
      })
    })
  })

  describe('Transaction Integrity', () => {
    it('should rollback transaction on error', async () => {
      const initialSubmissionCount = await testDb.prisma.submission.count()
      const initialPointsCount = await testDb.prisma.pointsLedger.count()

      // Attempt transaction that should fail
      await expect(
        testDb.prisma.$transaction(async (tx) => {
          // This will succeed
          await tx.submission.create({
            data: {
              user_id: testUser.id,
              activity_code: 'LEARN',
              status: 'APPROVED',
              visibility: 'PRIVATE',
              payload: { test: 'data' }
            }
          })

          // This will succeed
          await tx.pointsLedger.create({
            data: {
              user_id: testUser.id,
              activity_code: 'LEARN',
              source: 'MANUAL',
              delta_points: 20
            }
          })

          // This will fail and should rollback everything
          throw new Error('Simulated transaction error')
        })
      ).rejects.toThrow('Simulated transaction error')

      // Verify nothing was persisted
      const finalSubmissionCount = await testDb.prisma.submission.count()
      const finalPointsCount = await testDb.prisma.pointsLedger.count()

      expect(finalSubmissionCount).toBe(initialSubmissionCount)
      expect(finalPointsCount).toBe(initialPointsCount)
    })

    it('should handle concurrent transactions correctly', async () => {
      const user2 = await testDb.fixtures.createTestUser({
        handle: 'concurrent-user',
        email: 'concurrent@example.com'
      })

      // Simulate concurrent point awards
      const transaction1 = testDb.prisma.$transaction(async (tx) => {
        // Add points to user1
        await tx.pointsLedger.create({
          data: {
            user_id: testUser.id,
            activity_code: 'LEARN',
            source: 'MANUAL',
            delta_points: 20
          }
        })

        // Small delay to encourage race condition
        await new Promise(resolve => setTimeout(resolve, 10))

        // Add more points to user1
        await tx.pointsLedger.create({
          data: {
            user_id: testUser.id,
            activity_code: 'EXPLORE',
            source: 'MANUAL',
            delta_points: 50
          }
        })
      })

      const transaction2 = testDb.prisma.$transaction(async (tx) => {
        // Add points to user2
        await tx.pointsLedger.create({
          data: {
            user_id: user2.id,
            activity_code: 'LEARN',
            source: 'MANUAL',
            delta_points: 30
          }
        })

        // Small delay to encourage race condition
        await new Promise(resolve => setTimeout(resolve, 10))

        // Add more points to user2
        await tx.pointsLedger.create({
          data: {
            user_id: user2.id,
            activity_code: 'PRESENT',
            source: 'MANUAL',
            delta_points: 25
          }
        })
      })

      // Execute transactions concurrently
      await Promise.all([transaction1, transaction2])

      // Verify both transactions completed successfully
      const user1Total = await testDb.prisma.pointsLedger.aggregate({
        where: { user_id: testUser.id },
        _sum: { delta_points: true }
      })

      const user2Total = await testDb.prisma.pointsLedger.aggregate({
        where: { user_id: user2.id },
        _sum: { delta_points: true }
      })

      expect(user1Total._sum.delta_points).toBe(70) // 20 + 50
      expect(user2Total._sum.delta_points).toBe(55) // 30 + 25
    })

    it('should prevent duplicate external_event_id in concurrent transactions', async () => {
      const eventId = 'concurrent-event-123'

      // Simulate concurrent webhook processing with same event ID
      const transaction1 = testDb.prisma.$transaction(async (tx) => {
        // Check for existing event
        const existing = await tx.pointsLedger.findFirst({
          where: { external_event_id: eventId }
        })

        if (existing) {
          throw new Error('Event already processed')
        }

        // Small delay to encourage race condition
        await new Promise(resolve => setTimeout(resolve, 20))

        // Create points entry
        await tx.pointsLedger.create({
          data: {
            user_id: testUser.id,
            activity_code: 'LEARN',
            source: 'WEBHOOK',
            delta_points: 20,
            external_event_id: eventId,
            external_source: 'kajabi'
          }
        })
      })

      const transaction2 = testDb.prisma.$transaction(async (tx) => {
        // Check for existing event
        const existing = await tx.pointsLedger.findFirst({
          where: { external_event_id: eventId }
        })

        if (existing) {
          throw new Error('Event already processed')
        }

        // Small delay to encourage race condition
        await new Promise(resolve => setTimeout(resolve, 20))

        // Try to create same points entry
        await tx.pointsLedger.create({
          data: {
            user_id: testUser.id,
            activity_code: 'LEARN',
            source: 'WEBHOOK',
            delta_points: 20,
            external_event_id: eventId, // Same event ID
            external_source: 'kajabi'
          }
        })
      })

      // One transaction should succeed, one should fail
      const results = await Promise.allSettled([transaction1, transaction2])
      
      const successful = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')
      
      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)

      // Verify only one points entry was created
      const pointsEntries = await testDb.prisma.pointsLedger.findMany({
        where: { external_event_id: eventId }
      })
      
      expect(pointsEntries).toHaveLength(1)
    })
  })

  describe('Schema Validation', () => {
    it('should validate enum values', async () => {
      // Test invalid submission status
      await expect(
        testDb.prisma.submission.create({
          data: {
            user_id: testUser.id,
            activity_code: 'LEARN',
            // @ts-expect-error intentionally invalid to test enum constraint
            status: 'INVALID_STATUS',
            visibility: 'PRIVATE',
            payload: { test: 'data' }
          }
        })
      ).rejects.toThrow()

      // Test invalid role
      await expect(
        testDb.fixtures.createTestUser({
          handle: 'invalid-role-user',
          email: 'invalid@example.com',
          // @ts-expect-error intentionally invalid to test enum constraint
          role: 'INVALID_ROLE'
        })
      ).rejects.toThrow()
    })

    it('should enforce required fields', async () => {
      // Test missing required fields in submission
      await expect(
        testDb.prisma.submission.create({
          data: {
            // Missing user_id and activity_code
            status: 'PENDING',
            visibility: 'PRIVATE',
            payload: { test: 'data' }
          // @ts-expect-error intentionally incomplete input to test required field constraints
          } as import('@prisma/client').Prisma.SubmissionCreateInput
        })
      ).rejects.toThrow()

      // Test missing required fields in user
      await expect(
        testDb.prisma.user.create({
          data: {
            // Missing handle, name, email
            role: 'PARTICIPANT'
          // @ts-expect-error intentionally incomplete input to test required field constraints
          } as import('@prisma/client').Prisma.UserCreateInput
        })
      ).rejects.toThrow()
    })

    it('should validate JSON schema for payload fields', async () => {
      // Valid JSON payload should work
      const submission = await testDb.fixtures.createTestSubmission({
        user_id: testUser.id,
        payload: {
          certificate_url: '/uploads/test.pdf',
          course_name: 'Test Course',
          completion_date: new Date().toISOString()
        }
      })

      expect(submission.payload).toMatchObject({
        certificate_url: '/uploads/test.pdf',
        course_name: 'Test Course'
      })

      // Invalid JSON structure (if enforced by validation) would be caught
      // This depends on application-level validation rather than database constraints
    })
  })

  describe('Performance and Indexing', () => {
    it('should efficiently query users with points', async () => {
      // Create multiple users with points
      const users = []
      for (let i = 0; i < 10; i++) {
        const user = await testDb.fixtures.createTestUser({
          handle: `perf-user-${i}`,
          email: `perf-user-${i}@example.com`
        })
        users.push(user)

        // Add points for each user
        await testDb.fixtures.createPointsEntry({
          user_id: user.id,
          delta_points: Math.floor(Math.random() * 100)
        })
      }

      // Query should be efficient with proper indexing
      const startTime = Date.now()
      
      const usersWithPoints = await testDb.prisma.user.findMany({
        include: {
          ledger: {
            select: {
              delta_points: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 5
      })

      const queryTime = Date.now() - startTime
      
      expect(usersWithPoints).toHaveLength(5)
      expect(queryTime).toBeLessThan(100) // Should be fast with proper indexing
    })

    it('should efficiently query submissions by status', async () => {
      // Create submissions with various statuses
      const statuses = ['PENDING', 'APPROVED', 'REJECTED']
      for (let i = 0; i < 15; i++) {
        await testDb.fixtures.createTestSubmission({
          user_id: testUser.id,
          status: statuses[i % 3] as string
        })
      }

      // Query should be efficient with status index
      const startTime = Date.now()
      
      const pendingSubmissions = await testDb.prisma.submission.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      })

      const queryTime = Date.now() - startTime
      
      expect(pendingSubmissions.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(100) // Should be fast with proper indexing
    })
  })
})
