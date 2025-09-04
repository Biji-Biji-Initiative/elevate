/**
 * Database Constraints and Validation Tests
 * Tests database constraints, unique indexes, and data integrity rules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase, withTestDatabase } from './helpers';
import { Role, SubmissionStatus, LedgerSource } from '@prisma/client';

describe('Database Constraints and Integrity', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('User Constraints', () => {
    it('should enforce unique handle constraint', withTestDatabase(async (db) => {
      // Create first user
      const user1 = await db.fixtures.createTestUser({
        handle: 'uniquehandle',
        name: 'Sari Dewi',
        email: 'sari@jakarta.edu.id',
      });

      expect(user1.handle).toBe('uniquehandle');

      // Attempt to create second user with same handle
      await expect(
        db.fixtures.createTestUser({
          handle: 'uniquehandle',
          name: 'Budi Santoso',
          email: 'budi@surabaya.edu.id',
        })
      ).rejects.toThrow();
    }));

    it('should enforce unique email constraint', withTestDatabase(async (db) => {
      // Create first user
      await db.fixtures.createTestUser({
        handle: 'user1',
        email: 'same@email.com',
      });

      // Attempt to create second user with same email
      await expect(
        db.fixtures.createTestUser({
          handle: 'user2',
          email: 'same@email.com',
        })
      ).rejects.toThrow();
    }));

    it('should enforce unique kajabi_contact_id constraint when not null', withTestDatabase(async (db) => {
      const kajabiId = 'unique-kajabi-id';

      // Create first user with kajabi_contact_id
      await db.fixtures.createTestUser({
        handle: 'user1',
        kajabi_contact_id: kajabiId,
      });

      // Attempt to create second user with same kajabi_contact_id
      await expect(
        db.fixtures.createTestUser({
          handle: 'user2',
          kajabi_contact_id: kajabiId,
        })
      ).rejects.toThrow();
    }));

    it('should allow multiple users with null kajabi_contact_id', withTestDatabase(async (db) => {
      // Create multiple users with null kajabi_contact_id
      const user1 = await db.fixtures.createTestUser({
        handle: 'user1',
        kajabi_contact_id: null,
      });

      const user2 = await db.fixtures.createTestUser({
        handle: 'user2',
        kajabi_contact_id: null,
      });

      expect(user1.kajabi_contact_id).toBeNull();
      expect(user2.kajabi_contact_id).toBeNull();
    }));

    it('should validate role enum values', withTestDatabase(async (db) => {
      // Valid roles should work
      const validRoles = [Role.PARTICIPANT, Role.REVIEWER, Role.ADMIN, Role.SUPERADMIN];
      
      for (const role of validRoles) {
        const user = await db.fixtures.createTestUser({
          role,
          handle: `user-${role.toLowerCase()}`,
        });
        expect(user.role).toBe(role);
      }

      // Invalid role should fail (this would be caught at TypeScript level usually)
      await expect(
        db.prisma.user.create({
          data: {
            id: 'test-invalid-role',
            handle: 'invalidrole',
            name: 'Invalid Role User',
            email: 'invalid@example.com',
            // @ts-expect-error intentionally invalid role for constraint test
            role: 'INVALID_ROLE',
          },
        })
      ).rejects.toThrow();
    }));
  });

  describe('Submission Constraints', () => {
    it('should enforce foreign key constraints to users and activities', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Valid submission should work
      const validSubmission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });
      expect(validSubmission.user_id).toBe(user.id);

      // Invalid user_id should fail
      await expect(
        db.prisma.submission.create({
          data: {
            user_id: 'non-existent-user',
            activity_code: 'LEARN',
            payload: { test: true },
          },
        })
      ).rejects.toThrow();

      // Invalid activity_code should fail
      await expect(
        db.prisma.submission.create({
          data: {
            user_id: user.id,
            activity_code: 'INVALID_ACTIVITY',
            payload: { test: true },
          },
        })
      ).rejects.toThrow();
    }));

    it('should validate submission status enum', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Valid statuses should work
      const validStatuses = [SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED];
      
      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        const submission = await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status,
        });
        expect(submission.status).toBe(status);
      }

      // Invalid status should fail
      await expect(
        db.prisma.submission.create({
          data: {
            user_id: user.id,
            activity_code: 'LEARN',
            payload: { test: true },
            // @ts-expect-error intentionally invalid status for constraint test
            status: 'INVALID_STATUS',
          },
        })
      ).rejects.toThrow();
    }));

    it('should enforce reviewer_id foreign key when not null', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const reviewer = await db.fixtures.createTestUser({
        role: Role.REVIEWER,
        handle: 'reviewer',
        email: 'reviewer@example.com',
      });

      // Valid reviewer_id should work
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
        reviewer_id: reviewer.id,
        status: SubmissionStatus.APPROVED,
      });
      expect(submission.reviewer_id).toBe(reviewer.id);

      // Invalid reviewer_id should fail
      await expect(
        db.prisma.submission.create({
          data: {
            user_id: user.id,
            activity_code: 'LEARN',
            payload: { test: true },
            reviewer_id: 'non-existent-reviewer',
          },
        })
      ).rejects.toThrow();
    }));

    it('should handle cascade delete from user', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      // Verify submission exists
      const foundSubmission = await db.prisma.submission.findUnique({
        where: { id: submission.id },
      });
      expect(foundSubmission).toBeTruthy();

      // Delete user (should cascade to submissions)
      await db.prisma.user.delete({ where: { id: user.id } });

      // Verify submission is also deleted
      const deletedSubmission = await db.prisma.submission.findUnique({
        where: { id: submission.id },
      });
      expect(deletedSubmission).toBeNull();
    }));
  });

  describe('Points Ledger Constraints', () => {
    it('should enforce foreign key constraints', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Valid points entry should work
      const pointsEntry = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });
      expect(pointsEntry.user_id).toBe(user.id);

      // Invalid user_id should fail
      await expect(
        db.prisma.pointsLedger.create({
          data: {
            user_id: 'non-existent-user',
            activity_code: 'LEARN',
            source: LedgerSource.FORM,
            delta_points: 20,
          },
        })
      ).rejects.toThrow();

      // Invalid activity_code should fail
      await expect(
        db.prisma.pointsLedger.create({
          data: {
            user_id: user.id,
            activity_code: 'INVALID_ACTIVITY',
            source: LedgerSource.FORM,
            delta_points: 20,
          },
        })
      ).rejects.toThrow();
    }));

    it('should enforce unique external_event_id constraint when not null', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const externalEventId = 'unique-external-event';

      // First entry with external_event_id should work
      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        external_event_id: externalEventId,
      });

      // Duplicate external_event_id should fail
      await expect(
        db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'EXPLORE',
          external_event_id: externalEventId,
        })
      ).rejects.toThrow();
    }));

    it('should allow multiple entries with null external_event_id', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Multiple entries with null external_event_id should work
      const entry1 = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        external_event_id: null,
      });

      const entry2 = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'EXPLORE',
        external_event_id: null,
      });

      expect(entry1.external_event_id).toBeNull();
      expect(entry2.external_event_id).toBeNull();
    }));

    it('should validate ledger source enum', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Valid sources should work
      const validSources = [LedgerSource.MANUAL, LedgerSource.WEBHOOK, LedgerSource.FORM];
      
      for (let i = 0; i < validSources.length; i++) {
        const source = validSources[i];
        const entry = await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          source,
        });
        expect(entry.source).toBe(source);
      }

      // Invalid source should fail
      await expect(
        db.prisma.pointsLedger.create({
          data: {
            user_id: user.id,
            activity_code: 'LEARN',
            // @ts-expect-error intentionally invalid source for constraint test
            source: 'INVALID_SOURCE',
            delta_points: 20,
          },
        })
      ).rejects.toThrow();
    }));

    it('should handle cascade delete from user', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const pointsEntry = await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      // Verify points entry exists
      const foundEntry = await db.prisma.pointsLedger.findUnique({
        where: { id: pointsEntry.id },
      });
      expect(foundEntry).toBeTruthy();

      // Delete user (should cascade to points ledger)
      await db.prisma.user.delete({ where: { id: user.id } });

      // Verify points entry is also deleted
      const deletedEntry = await db.prisma.pointsLedger.findUnique({
        where: { id: pointsEntry.id },
      });
      expect(deletedEntry).toBeNull();
    }));
  });

  describe('Submission Attachment Constraints', () => {
    it('should enforce foreign key constraint to submission', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      // Valid attachment should work
      const attachment = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: '/uploads/test-file.pdf',
          hash: 'abc123',
        },
      });
      expect(attachment.submission_id).toBe(submission.id);

      // Invalid submission_id should fail
      await expect(
        db.prisma.submissionAttachment.create({
          data: {
            submission_id: 'non-existent-submission',
            path: '/uploads/invalid.pdf',
          },
        })
      ).rejects.toThrow();
    }));

    it('should enforce unique submission_id + path constraint', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      const filePath = '/uploads/duplicate-path.pdf';

      // First attachment with path should work
      await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: filePath,
          hash: 'hash1',
        },
      });

      // Duplicate path for same submission should fail
      await expect(
        db.prisma.submissionAttachment.create({
          data: {
            submission_id: submission.id!,
            path: filePath,
            hash: 'hash2',
          },
        })
      ).rejects.toThrow();
    }));

    it('should allow same path for different submissions', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission1 = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });
      const submission2 = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'EXPLORE',
      });

      const filePath = '/uploads/same-name.pdf';

      // Same path for different submissions should work
      const attachment1 = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission1.id!,
          path: filePath,
          hash: 'hash1',
        },
      });

      const attachment2 = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission2.id!,
          path: filePath,
          hash: 'hash2',
        },
      });

      expect(attachment1.path).toBe(filePath);
      expect(attachment2.path).toBe(filePath);
    }));

    it('should handle cascade delete from submission', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      const submission = await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
      });

      const attachment = await db.prisma.submissionAttachment.create({
        data: {
          submission_id: submission.id!,
          path: '/uploads/test-cascade.pdf',
          hash: 'cascade-hash',
        },
      });

      // Verify attachment exists
      const foundAttachment = await db.prisma.submissionAttachment.findUnique({
        where: { id: attachment.id },
      });
      expect(foundAttachment).toBeTruthy();

      // Delete submission (should cascade to attachments)
      await db.prisma.submission.delete({ where: { id: submission.id } });

      // Verify attachment is also deleted
      const deletedAttachment = await db.prisma.submissionAttachment.findUnique({
        where: { id: attachment.id },
      });
      expect(deletedAttachment).toBeNull();
    }));
  });

  describe('Badge Constraints', () => {
    it('should enforce unique badge_code + user_id in earned_badges', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // First badge award should work
      await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      // Duplicate badge award should fail
      await expect(
        db.prisma.earnedBadge.create({
          data: {
            user_id: user.id,
            badge_code: 'FIRST_STEPS',
          },
        })
      ).rejects.toThrow();
    }));

    it('should allow same badge for different users', withTestDatabase(async (db) => {
      const user1 = await db.fixtures.createTestUser({ handle: 'user1' });
      const user2 = await db.fixtures.createTestUser({ handle: 'user2' });

      // Same badge for different users should work
      const badge1 = await db.prisma.earnedBadge.create({
        data: {
          user_id: user1.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      const badge2 = await db.prisma.earnedBadge.create({
        data: {
          user_id: user2.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      expect(badge1.badge_code).toBe('FIRST_STEPS');
      expect(badge2.badge_code).toBe('FIRST_STEPS');
    }));

    it('should handle cascade delete from user and badge', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      const earnedBadge = await db.prisma.earnedBadge.create({
        data: {
          user_id: user.id,
          badge_code: 'FIRST_STEPS',
        },
      });

      // Verify earned badge exists
      let foundBadge = await db.prisma.earnedBadge.findUnique({
        where: { id: earnedBadge.id },
      });
      expect(foundBadge).toBeTruthy();

      // Delete user (should cascade to earned badges)
      await db.prisma.user.delete({ where: { id: user.id } });

      // Verify earned badge is also deleted
      foundBadge = await db.prisma.earnedBadge.findUnique({
        where: { id: earnedBadge.id },
      });
      expect(foundBadge).toBeNull();
    }));
  });

  describe('Index Performance and Constraints', () => {
    it('should use indexes efficiently for common queries', withTestDatabase(async (db) => {
      // Create test data for index testing
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `indextest${i}`,
          })
        )
      );

      // Create submissions and points
      for (const user of users) {
        await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
        });
        
        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
        });
      }

      // These queries should be fast due to indexes
      const startTime = Date.now();

      // Query by user_id (should use user_id index)
      const userSubmissions = await db.prisma.submission.findMany({
        where: { user_id: users[0].id },
      });

      // Query by activity_code (should use activity_code index) 
      const learnSubmissions = await db.prisma.submission.findMany({
        where: { activity_code: 'LEARN' },
      });

      // Query points by user_id (should use user_id index)
      const userPoints = await db.prisma.pointsLedger.findMany({
        where: { user_id: users[0].id },
      });

      const queryTime = Date.now() - startTime;

      // All queries should complete quickly
      expect(queryTime).toBeLessThan(100); // Less than 100ms
      expect(userSubmissions.length).toBeGreaterThan(0);
      expect(learnSubmissions.length).toBe(10);
      expect(userPoints.length).toBeGreaterThan(0);
    }));
  });

  describe('JSON Data Validation', () => {
    it('should handle complex JSON payloads in submissions', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();

      // Complex payload with nested objects and arrays
      const complexPayload = {
        title: 'Complex AI Implementation',
        metadata: {
          version: '1.0',
          tools: ['ChatGPT', 'Canva AI'],
          metrics: {
            engagement: 95,
            completion_rate: 0.85,
          },
        },
        evidence_urls: [
          'https://example.com/evidence1.pdf',
          'https://example.com/evidence2.jpg',
        ],
        indonesian_text: 'Implementasi AI yang sangat efektif',
      };

      const submission = await db.prisma.submission.create({
        data: {
          user_id: user.id,
          activity_code: 'EXPLORE',
          payload: complexPayload,
        },
      });

      // Retrieve and verify JSON integrity
      const retrieved = await db.prisma.submission.findUnique({
        where: { id: submission.id },
      });

      expect(retrieved?.payload).toEqual(complexPayload);
    }));

    it('should handle badge criteria JSON validation', withTestDatabase(async (db) => {
      // Complex badge criteria
      const complexCriteria = {
        min_points: 100,
        required_activities: ['LEARN', 'EXPLORE'],
        conditions: {
          peer_training_count: { min: 5, max: 50 },
          completion_timeframe: '30_days',
        },
        indonesian_requirements: {
          school_type: ['SMAN', 'SMP', 'SMK'],
          region: ['Jakarta', 'Surabaya', 'Bandung'],
        },
      };

      await db.prisma.badge.create({
        data: {
          code: 'COMPLEX_BADGE',
          name: 'Complex Achievement Badge',
          description: 'A badge with complex criteria',
          criteria: complexCriteria,
        },
      });

      // Retrieve and verify criteria integrity
      const retrieved = await db.prisma.badge.findUnique({
        where: { code: 'COMPLEX_BADGE' },
      });

      expect(retrieved?.criteria).toEqual(complexCriteria);
    }));
  });
});
