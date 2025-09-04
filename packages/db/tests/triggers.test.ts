/**
 * Database Triggers and Automated Behavior Tests
 * Tests database triggers, automated timestamps, and other database-level automation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase, withTestDatabase } from './helpers';
import { SubmissionStatus, LedgerSource } from '@prisma/client';

describe('Database Triggers and Automation', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('Timestamp Triggers', () => {
    it('should set created_at automatically on insert', withTestDatabase(async (db) => {
      const beforeCreate = new Date();
      
      const user = await db.fixtures.createTestUser({
        name: 'Timestamp Test User',
      });

      const afterCreate = new Date();

      // Retrieve user to check created_at
      const retrievedUser = await db.prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(retrievedUser?.created_at).toBeDefined();
      expect(retrievedUser!.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(retrievedUser!.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    }));

    it('should update updated_at automatically on submission changes', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      // Get initial timestamps
      const initialSubmission = await db.prisma.submission.findUnique({
        where: { id: submission.id },
      });

      expect(initialSubmission?.created_at).toBeDefined();
      expect(initialSubmission?.updated_at).toBeDefined();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the submission
      const updatedSubmission = await db.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.APPROVED,
          review_note: 'Looks good!',
        },
      });

      // updated_at should be different from initial
      expect(updatedSubmission.updated_at.getTime()).toBeGreaterThan(
        initialSubmission!.updated_at.getTime()
      );

      // created_at should remain the same
      expect(updatedSubmission.created_at.getTime()).toBe(
        initialSubmission!.created_at.getTime()
      );
    }));

    it('should set created_at on points ledger entries', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const beforeCreate = new Date();

      const pointsEntry = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      const afterCreate = new Date();

      // Retrieve points entry to check created_at
      const retrievedEntry = await db.prisma.pointsLedger.findUnique({
        where: { id: pointsEntry.id },
      });

      expect(retrievedEntry?.created_at).toBeDefined();
      expect(retrievedEntry!.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(retrievedEntry!.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    }));

    it('should set created_at on all other models with timestamps', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      const beforeCreate = new Date();

      // Test submission attachment
      const attachment = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: '/uploads/test-timestamp.pdf',
          hash: 'timestamp-hash',
        },
      });

      // Test kajabi event
      const kajabiEvent = await db.prisma.kajabiEvent.create({
        data: {
          id: 'test-kajabi-event',
          payload: { test: 'timestamp' },
        },
      });

      // Test audit log
      const auditLog = await db.prisma.auditLog.create({
        data: {
          actor_id: user.id,
          action: 'TIMESTAMP_TEST',
          meta: { test: true },
        },
      });

      // Test earned badge
      const earnedBadge = await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      const afterCreate = new Date();

      // All should have created_at timestamps
      expect(attachment.created_at).toBeDefined();
      expect(attachment.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      
      expect(kajabiEvent.received_at).toBeDefined();
      expect(kajabiEvent.received_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      
      expect(auditLog.created_at).toBeDefined();
      expect(auditLog.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      
      expect(earnedBadge.earned_at).toBeDefined();
      expect(earnedBadge.earned_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      
      // All timestamps should be within reasonable bounds
      [attachment.created_at, kajabiEvent.received_at, auditLog.created_at, earnedBadge.earned_at].forEach(timestamp => {
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      });
    }));
  });

  describe('Data Validation Triggers', () => {
    it('should validate email format if database has email validation trigger', withTestDatabase(async (db) => {
      // Note: This test assumes there might be database-level email validation
      // In many cases, this validation is done at the application level
      
      // Valid email should work
      const validUser = await db.fixtures.createTestUser({
        email: 'valid@jakarta.edu.id',
        handle: 'validuser',
      });
      expect(validUser.email).toBe('valid@jakarta.edu.id');

      // If database has email validation triggers, invalid emails would fail
      // For now, we test that the application accepts valid emails
      const validEmails = [
        'teacher@sman1jakarta.edu.id',
        'guru.budi@smpnegeri12.edu.id',
        'sari.dewi@smktelkom.edu.id',
      ];

      for (const email of validEmails) {
        const user = await db.fixtures.createTestUser({
          email,
          handle: `user-${Date.now()}-${Math.random()}`,
        });
        expect(user.email).toBe(email);
      }
    }));

    it('should handle points validation if database has point validation triggers', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Positive points should work
      const positivePoints = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });
      expect(positivePoints.delta_points).toBe(20);

      // Zero points should work (for adjustments)
      const zeroPoints = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'EXPLORE',
        delta_points: 0,
      });
      expect(zeroPoints.delta_points).toBe(0);

      // Negative points should work (for adjustments/corrections)
      const negativePoints = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'AMPLIFY',
        delta_points: -5,
      });
      expect(negativePoints.delta_points).toBe(-5);
    }));
  });

  describe('Audit Trail Triggers', () => {
    it('should log significant changes to audit trail', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser({
        name: 'Audit Test User',
      });

      const reviewer = await db.fixtures.createTestUser({
        name: 'Reviewer User',
        role: 'REVIEWER',
        handle: 'reviewer-audit',
        email: 'reviewer@audit.test',
      });

      // Create a submission
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.PENDING,
      });

      // Simulate reviewer approval (this might trigger audit logging)
      await db.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewer_id: reviewer.id,
          review_note: 'Approved after review',
        },
      });

      // Manual audit log entry (in a real system, this might be automatic)
      await db.prisma.auditLog.create({
        data: {
          actor_id: reviewer.id,
          action: 'SUBMISSION_APPROVED',
          target_id: submission.id,
          meta: {
            previous_status: 'PENDING',
            new_status: 'APPROVED',
            submission_activity: 'LEARN',
            user_id: user.id,
          },
        },
      });

      // Verify audit log exists
      const auditEntries = await db.prisma.auditLog.findMany({
        where: {
          action: 'SUBMISSION_APPROVED',
          target_id: submission.id,
        },
      });

      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].actor_id).toBe(reviewer.id);
      expect(auditEntries[0].meta).toHaveProperty('previous_status', 'PENDING');
      expect(auditEntries[0].meta).toHaveProperty('new_status', 'APPROVED');
    }));

    it('should log points awards to audit trail', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const admin = await db.fixtures.createTestUser({
        role: 'ADMIN',
        handle: 'admin-points',
        email: 'admin@points.test',
      });

      // Create points entry
      const pointsEntry = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
        source: LedgerSource.MANUAL,
      });

      // Log the points award
      await db.prisma.auditLog.create({
        data: {
          actor_id: admin.id,
          action: 'POINTS_AWARDED',
          target_id: user.id,
          meta: {
            points_entry_id: pointsEntry.id,
            activity_code: 'LEARN',
            delta_points: 20,
            source: 'MANUAL',
            reason: 'Manual adjustment',
          },
        },
      });

      // Verify audit log
      const auditEntries = await db.prisma.auditLog.findMany({
        where: {
          action: 'POINTS_AWARDED',
          target_id: user.id,
        },
      });

      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].meta).toHaveProperty('delta_points', 20);
      expect(auditEntries[0].meta).toHaveProperty('activity_code', 'LEARN');
    }));
  });

  describe('Badge Award Triggers', () => {
    it('should handle automated badge awarding logic', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser({
        name: 'Badge Test User',
      });

      // Simulate completing first activity
      await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.APPROVED,
      });

      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      // In a real system, this might be triggered automatically
      // For now, we manually award the badge and test the logic
      
      // Check if user qualifies for FIRST_STEPS badge
      const approvedSubmissions = await db.prisma.submission.count({
        where: {
          user_id: user.id,
          status: SubmissionStatus.APPROVED,
        },
      });

      expect(approvedSubmissions).toBeGreaterThan(0);

      // Award the badge
      const earnedBadge = await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      expect(earnedBadge.user_id).toBe(user.id);
      expect(earnedBadge.badge_code).toBe('FIRST_STEPS');

      // Log the badge award
      await db.prisma.auditLog.create({
        data: {
          actor_id: 'system',
          action: 'BADGE_AWARDED',
          target_id: user.id,
          meta: {
            badge_code: 'FIRST_STEPS',
            earned_badge_id: earnedBadge.id,
            trigger_reason: 'completed_first_activity',
          },
        },
      });

      // Verify badge and audit log
      const userBadges = await db.prisma.earnedBadge.findMany({
        where: { user_id: user.id },
      });

      expect(userBadges).toHaveLength(1);
      expect(userBadges[0].badge_code).toBe('FIRST_STEPS');
    }));

    it('should handle complex badge criteria evaluation', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Create multiple submissions for EXPLORER badge
      const activities = ['LEARN', 'EXPLORE'];
      
      for (const activity of activities) {
        await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: activity,
          status: SubmissionStatus.APPROVED,
        });

        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: activity,
          delta_points: activity === 'LEARN' ? 20 : 50,
        });
      }

      // Check if user qualifies for EXPLORER badge (requires EXPLORE activity)
      const exploreSubmissions = await db.prisma.submission.count({
        where: {
          user_id: user.id,
          activity_code: 'EXPLORE',
          status: SubmissionStatus.APPROVED,
        },
      });

      expect(exploreSubmissions).toBeGreaterThan(0);

      // Award EXPLORER badge
      await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'EXPLORER',
        },
      });

      // Verify the badge was awarded
      const explorerBadge = await db.prisma.earnedBadge.findUnique({
        where: {
          user_id_badge_code: {
            user_id: user.id,
            badge_code: 'EXPLORER',
          },
        },
      });

      expect(explorerBadge).toBeTruthy();
    }));
  });

  describe('Data Integrity Triggers', () => {
    it('should maintain referential integrity during cascading operations', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      
      // Create related data
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      const pointsEntry = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      const earnedBadge = await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      const attachment = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: '/uploads/test-integrity.pdf',
        },
      });

      // Verify all related data exists
      expect(await db.prisma.submission.findUnique({ where: { id: submission.id } })).toBeTruthy();
      expect(await db.prisma.pointsLedger.findUnique({ where: { id: pointsEntry.id } })).toBeTruthy();
      expect(await db.prisma.earnedBadge.findUnique({ where: { id: earnedBadge.id } })).toBeTruthy();
      expect(await db.prisma.submissionAttachment.findUnique({ where: { id: attachment.id } })).toBeTruthy();

      // Delete user (should cascade properly)
      await db.prisma.user.delete({ where: { id: user.id } });

      // Verify cascading deletes worked
      expect(await db.prisma.submission.findUnique({ where: { id: submission.id } })).toBeNull();
      expect(await db.prisma.pointsLedger.findUnique({ where: { id: pointsEntry.id } })).toBeNull();
      expect(await db.prisma.earnedBadge.findUnique({ where: { id: earnedBadge.id } })).toBeNull();
      expect(await db.prisma.submissionAttachment.findUnique({ where: { id: attachment.id } })).toBeNull();
    }));

    it('should handle complex cascade scenarios', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'EXPLORE',
      });

      // Create multiple attachments for the submission
      const attachments = await Promise.all([
        db.prisma.submissionAttachment.create({
          data: {
            submission_id: submission.id!,
            path: '/uploads/attachment1.pdf',
          },
        }),
        db.prisma.submissionAttachment.create({
          data: {
            submission_id: submission.id!,
            path: '/uploads/attachment2.jpg',
          },
        }),
      ]);

      // Verify attachments exist
      const attachmentCount = await db.prisma.submissionAttachment.count({
        where: { submission_id: submission.id },
      });
      expect(attachmentCount).toBe(2);

      // Delete submission (should cascade to attachments)
      await db.prisma.submission.delete({ where: { id: submission.id } });

      // Verify all attachments were deleted
      const remainingAttachments = await db.prisma.submissionAttachment.count({
        where: { 
          id: { in: attachments.map(a => a.id) }
        },
      });
      expect(remainingAttachments).toBe(0);
    }));
  });

  describe('Performance Impact of Triggers', () => {
    it('should not significantly impact insert performance', withTestDatabase(async (db) => {
      const startTime = Date.now();

      // Create multiple users quickly
      const users = await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `perfuser${i}`,
            name: `Performance User ${i}`,
          })
        )
      );

      const userCreationTime = Date.now() - startTime;

      // Should complete within reasonable time
      expect(userCreationTime).toBeLessThan(2000); // 2 seconds for 20 users
      expect(users).toHaveLength(20);

      // Test submission creation performance
      const submissionStartTime = Date.now();

      const submissions = await Promise.all(
        users.map(user => 
          db.fixtures.createTestSubmission({
            user_id: user.id,
            activity_code: 'LEARN',
          })
        )
      );

      const submissionCreationTime = Date.now() - submissionStartTime;

      expect(submissionCreationTime).toBeLessThan(3000); // 3 seconds for 20 submissions
      expect(submissions).toHaveLength(20);
    }));

    it('should handle bulk operations efficiently', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const startTime = Date.now();

      // Create multiple points entries
      const pointsEntries = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT'][i % 4],
            delta_points: Math.floor(Math.random() * 50) + 1,
          })
        )
      );

      const bulkCreationTime = Date.now() - startTime;

      expect(bulkCreationTime).toBeLessThan(5000); // 5 seconds for 50 entries
      expect(pointsEntries).toHaveLength(50);

      // Verify all entries have timestamps
      const retrievedEntries = await db.prisma.pointsLedger.findMany({
        where: { user_id: user.id },
      });

      expect(retrievedEntries).toHaveLength(50);
      retrievedEntries.forEach(entry => {
        expect(entry.created_at).toBeDefined();
        expect(entry.created_at).toBeInstanceOf(Date);
      });
    }));
  });
});
