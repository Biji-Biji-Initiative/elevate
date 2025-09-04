/**
 * Analytics and Materialized Views Tests
 * Tests the analytics views and performance of leaderboard calculations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase, PerformanceHelper, withTestDatabase } from './helpers';
import type { DatabaseFixtures } from './fixtures';
import { Prisma, SubmissionStatus, Visibility, Role } from '@prisma/client';

describe('Analytics Views and Performance', () => {
  let testDb: TestDatabase;
  let fixtures: DatabaseFixtures;
  let perfHelper: PerformanceHelper;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    fixtures = testDb.fixtures;
    perfHelper = new PerformanceHelper(testDb.prisma);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('Leaderboard Totals View', () => {
    it('should calculate total points correctly', withTestDatabase(async (db) => {
      // Create test user with multiple submissions
      const user = await db.fixtures.createTestUser({
        handle: 'leadertest',
        name: 'Sari Dewi',
        email: 'sari@jakarta.edu.id',
      });

      // Create approved submissions with points
      await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.APPROVED,
        visibility: Visibility.PUBLIC,
      });

      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      await db.fixtures.createTestSubmission({
        user_id: user.id,
        activity_code: 'EXPLORE',
        status: SubmissionStatus.APPROVED,
        visibility: Visibility.PUBLIC,
      });

      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'EXPLORE',
        delta_points: 50,
      });

      // Refresh materialized views
      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      // Query leaderboard totals view
      const leaderboard = await db.prisma.$queryRaw<Array<{
        user_id: string;
        handle: string;
        name: string;
        total_points: number;
        public_submissions: number;
      }>>`
        SELECT user_id, handle, name, total_points, public_submissions
        FROM leaderboard_totals
        WHERE handle = 'leadertest'
      `;

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].total_points).toBe(70);
      expect(leaderboard[0].public_submissions).toBe(2);
      expect(leaderboard[0].name).toBe('Sari Dewi');
    }));

    it('should only include participants with points', withTestDatabase(async (db) => {
      // Create user with no points
      await db.fixtures.createTestUser({
        handle: 'nopoints',
        name: 'Budi Santoso',
      });

      // Create user with points
      const userWithPoints = await db.fixtures.createTestUser({
        handle: 'withpoints',
        name: 'Rina Kusumawati',
      });

      await db.fixtures.createPointsEntry({
        user_id: userWithPoints.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      // Refresh materialized view
      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      const leaderboard = await db.prisma.$queryRaw<Array<{
        handle: string;
        total_points: number;
      }>>`
        SELECT handle, total_points
        FROM leaderboard_totals
      `;

      // Should only include user with points
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].handle).toBe('withpoints');
    }));

    it('should exclude non-participants from leaderboard', withTestDatabase(async (db) => {
      // Create admin user with points
      const admin = await db.fixtures.createTestUser({
        handle: 'admin',
        name: 'Admin User',
        role: Role.ADMIN,
      });

      await db.fixtures.createPointsEntry({
        user_id: admin.id,
        activity_code: 'LEARN',
        delta_points: 100,
      });

      // Create participant with points
      const participant = await db.fixtures.createTestUser({
        handle: 'participant',
        name: 'Ahmad Fauzi',
        role: Role.PARTICIPANT,
      });

      await db.fixtures.createPointsEntry({
        user_id: participant.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      const leaderboard = await db.prisma.$queryRaw<Array<{
        handle: string;
        total_points: number;
      }>>`
        SELECT handle, total_points
        FROM leaderboard_totals
      `;

      // Should only include participant
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].handle).toBe('participant');
    }));
  });

  describe('30-Day Rolling Leaderboard', () => {
    it('should only include recent activity', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser({
        handle: '30daytest',
        name: 'Dewi Lestari',
      });

      // Create old points entry (should be excluded)
      await db.prisma.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'FORM',
          delta_points: 50,
          created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        },
      });

      // Create recent points entry (should be included)
      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'EXPLORE',
        delta_points: 30,
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_30d`;

      const leaderboard30d = await db.prisma.$queryRaw<Array<{
        handle: string;
        total_points: number;
      }>>`
        SELECT handle, total_points
        FROM leaderboard_30d
        WHERE handle = '30daytest'
      `;

      expect(leaderboard30d).toHaveLength(1);
      expect(leaderboard30d[0].total_points).toBe(30); // Only recent points
    }));

    it('should handle users with no recent activity', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser({
        handle: 'oldactivity',
        name: 'Rahmat Hidayat',
      });

      // Create only old activity
      await db.prisma.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'FORM',
          delta_points: 100,
          created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
        },
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_30d`;

      const leaderboard30d = await db.prisma.$queryRaw<Array<{
        handle: string;
      }>>`
        SELECT handle
        FROM leaderboard_30d
        WHERE handle = 'oldactivity'
      `;

      // Should not appear in 30-day leaderboard
      expect(leaderboard30d).toHaveLength(0);
    }));
  });

  describe('Activity Metrics View', () => {
    it('should aggregate submission statistics correctly', withTestDatabase(async (db) => {
      const user1 = await db.fixtures.createTestUser({ name: 'Sri Wahyuni' });
      const user2 = await db.fixtures.createTestUser({ name: 'Agung Setiawan' });

      // Create various LEARN submissions
      await db.fixtures.createTestSubmission({
        user_id: user1.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.PENDING,
      });

      await db.fixtures.createTestSubmission({
        user_id: user1.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.APPROVED,
        visibility: Visibility.PUBLIC,
      });

      await db.fixtures.createTestSubmission({
        user_id: user2.id,
        activity_code: 'LEARN',
        status: SubmissionStatus.REJECTED,
      });

      // Create corresponding points
      await db.fixtures.createPointsEntry({
        user_id: user1.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW activity_metrics`;

      const metrics = await db.prisma.$queryRaw<Array<{
        code: string;
        name: string;
        total_submissions: number;
        pending_submissions: number;
        approved_submissions: number;
        rejected_submissions: number;
        public_submissions: number;
        total_points_awarded: number;
      }>>`
        SELECT code, name, total_submissions, pending_submissions, 
               approved_submissions, rejected_submissions, public_submissions,
               total_points_awarded
        FROM activity_metrics
        WHERE code = 'LEARN'
      `;

      expect(metrics).toHaveLength(1);
      const learnMetrics = metrics[0];
      
      expect(learnMetrics.total_submissions).toBe(3);
      expect(learnMetrics.pending_submissions).toBe(1);
      expect(learnMetrics.approved_submissions).toBe(1);
      expect(learnMetrics.rejected_submissions).toBe(1);
      expect(learnMetrics.public_submissions).toBe(1);
      expect(learnMetrics.total_points_awarded).toBe(20);
    }));

    it('should include all activities even with no submissions', withTestDatabase(async (db) => {
      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW activity_metrics`;

      const metrics = await db.prisma.$queryRaw<Array<{
        code: string;
        total_submissions: number;
      }>>`
        SELECT code, total_submissions
        FROM activity_metrics
        ORDER BY code
      `;

      // Should have all 5 activities
      expect(metrics).toHaveLength(5);
      const codes = metrics.map(m => m.code);
      expect(codes).toEqual(['AMPLIFY', 'EXPLORE', 'LEARN', 'PRESENT', 'SHINE']);
      
      // Activities without submissions should have 0
      metrics.forEach(metric => {
        expect(metric.total_submissions).toBe(0);
      });
    }));
  });

  describe('Performance Benchmarks', () => {
    it('should refresh materialized views within acceptable time', async () => {
      // Create test data for performance testing
      const users = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          fixtures.createTestUser({
            handle: `perftest${i}`,
            name: `Performance User ${i}`,
          })
        )
      );

      // Create submissions and points for each user
      for (const user of users) {
        await fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.APPROVED,
          visibility: Visibility.PUBLIC,
        });

        await fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
        });
      }

      // Benchmark materialized view refresh
      const refreshStart = Date.now();
      await testDb.prisma.$executeRaw`SELECT refresh_leaderboards()`;
      const refreshDuration = Date.now() - refreshStart;

      // Should complete within 5 seconds for 50 users
      expect(refreshDuration).toBeLessThan(5000);
    });

    it('should query leaderboard efficiently', async () => {
      // Use the performance helper to benchmark leaderboard queries
      const benchmark = await perfHelper.benchmarkLeaderboard(5);

      // Average query time should be under 100ms
      expect(benchmark.avgDuration).toBeLessThan(100);
      
      // No query should take more than 500ms
      expect(benchmark.maxDuration).toBeLessThan(500);
      
      // Results should be consistent
      const variance = benchmark.maxDuration - benchmark.minDuration;
      expect(variance).toBeLessThan(200); // Less than 200ms variance
    });
  });

  describe('Indonesian Context Validation', () => {
    it('should handle Indonesian names and schools correctly in views', withTestDatabase(async (db) => {
      // Create users with Indonesian context
      const users = await Promise.all([
        db.fixtures.createTestUser({ 
          name: 'Sari Dewi',
          school: 'SMAN 1 Jakarta',
          cohort: 'MS Elevate Jakarta 2024'
        }),
        db.fixtures.createTestUser({ 
          name: 'Budi Santoso',
          school: 'SMP Negeri 12 Surabaya',
          cohort: 'MS Elevate Surabaya 2024'
        }),
      ]);

      // Add points for each user
      for (const user of users) {
        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
        });
      }

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      const leaderboard = await db.prisma.$queryRaw<Array<{
        name: string;
        school: string;
        cohort: string;
        total_points: number;
      }>>`
        SELECT name, school, cohort, total_points
        FROM leaderboard_totals
        ORDER BY name
      `;

      expect(leaderboard).toHaveLength(2);
      
      // Verify Indonesian names are preserved
      expect(leaderboard[0].name).toBe('Budi Santoso');
      expect(leaderboard[1].name).toBe('Sari Dewi');
      
      // Verify school names are preserved
      expect(leaderboard[0].school).toBe('SMP Negeri 12 Surabaya');
      expect(leaderboard[1].school).toBe('SMAN 1 Jakarta');
      
      // Verify cohort format
      expect(leaderboard[0].cohort).toBe('MS Elevate Surabaya 2024');
      expect(leaderboard[1].cohort).toBe('MS Elevate Jakarta 2024');
    }));
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent materialized view refreshes', withTestDatabase(async (db) => {
      // Create some test data
      const user = await db.fixtures.createTestUser();
      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      // Attempt concurrent refreshes
      const refreshPromises = Array.from({ length: 3 }, () => 
        db.prisma.$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals`)
      );

      // Should not throw errors
      await expect(Promise.all(refreshPromises)).resolves.not.toThrow();
    }));

    it('should handle null values gracefully in aggregations', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser({
        school: null, // Test null school
        cohort: null, // Test null cohort
      });

      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      const leaderboard = await db.prisma.$queryRaw<Array<{ handle: string; school: string | null; cohort: string | null; total_points: number }>>(
        Prisma.sql`SELECT handle, school, cohort, total_points FROM leaderboard_totals WHERE handle = ${user.handle}`
      );

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].school).toBeNull();
      expect(leaderboard[0].cohort).toBeNull();
      expect(leaderboard[0].total_points).toBe(20);
    }));

    it('should validate view consistency after data changes', withTestDatabase(async (db) => {
      const user = await db.fixtures.createTestUser();
      
      // Create initial data
      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'LEARN',
        delta_points: 20,
      });

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      let leaderboard = await db.prisma.$queryRaw<Array<{ total_points: number }>>(
        Prisma.sql`SELECT total_points FROM leaderboard_totals WHERE handle = ${user.handle}`
      );

      expect(leaderboard[0].total_points).toBe(20);

      // Add more points
      await db.fixtures.createPointsEntry({
        user_id: user.id,
        activity_code: 'EXPLORE',
        delta_points: 50,
      });

      // Before refresh - should still show old total
      leaderboard = await db.prisma.$queryRaw<Array<{ total_points: number }>>(
        Prisma.sql`SELECT total_points FROM leaderboard_totals WHERE handle = ${user.handle}`
      );
      expect(leaderboard[0].total_points).toBe(20);

      // After refresh - should show updated total
      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;
      
      leaderboard = await db.prisma.$queryRaw<Array<{ total_points: number }>>(
        Prisma.sql`SELECT total_points FROM leaderboard_totals WHERE handle = ${user.handle}`
      );
      expect(leaderboard[0].total_points).toBe(70);
    }));
  });
});
