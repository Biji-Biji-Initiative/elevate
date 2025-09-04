/**
 * Performance Benchmarks and Load Testing
 * Tests database performance under various conditions and loads
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabase, withTestDatabase } from './helpers';
import { SubmissionStatus, Visibility, LedgerSource } from '@prisma/client';
import { getSecureLogger } from '../src/logger';

describe('Database Performance Benchmarks', () => {
  let testDb: TestDatabase;
  
  const logger = getSecureLogger();

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('Materialized Views Performance', () => {
    it('should refresh leaderboard views within time limits', withTestDatabase(async (db) => {
      // Create test data at scale
      const userCount = 100;
      const submissionsPerUser = 3;
      
      logger.database({
        operation: 'PERF_TEST_START',
        table: 'leaderboard_performance',
        duration: 0,
        recordCount: 0,
        metadata: { userCount, submissionsPerUser },
      });

      const startDataCreation = Date.now();

      // Create users with Indonesian context
      const users = await Promise.all(
        Array.from({ length: userCount }, (_, i) => {
          return db.fixtures.createTestUser({
            handle: `perfuser${i}`,
            name: `Performance User ${i}`,
            school: `SMAN ${i % 5 + 1} Performance City`,
            cohort: `MS Elevate Batch ${Math.floor(i / 20) + 1} 2024`,
          });
        })
      );

      // Create submissions and points for each user
      const activities = ['LEARN', 'EXPLORE', 'AMPLIFY'];
      for (const user of users) {
        for (let j = 0; j < submissionsPerUser; j++) {
          const activity = activities[j % activities.length];
          
          await db.fixtures.createTestSubmission({
            user_id: user.id,
            activity_code: activity,
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
          });

          await db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: activity,
            delta_points: activity === 'LEARN' ? 20 : activity === 'EXPLORE' ? 50 : 25,
          });
        }
      }

      const dataCreationTime = Date.now() - startDataCreation;
      
      // Benchmark materialized view refresh
      const refreshStart = Date.now();
      await db.prisma.$executeRaw`SELECT refresh_leaderboards()`;
      const refreshTime = Date.now() - refreshStart;

      logger.database({
        operation: 'MV_REFRESH_BENCHMARK',
        table: 'materialized_views',
        duration: refreshTime,
        recordCount: userCount * submissionsPerUser,
        metadata: {
          userCount,
          totalSubmissions: userCount * submissionsPerUser,
          dataCreationTime,
          refreshTime,
        },
      });

      // Performance requirements
      expect(refreshTime).toBeLessThan(10000); // Less than 10 seconds
      expect(dataCreationTime).toBeLessThan(30000); // Less than 30 seconds for data creation

      // Verify data integrity after refresh
      const leaderboard = await db.prisma.$queryRaw<Array<{
        handle: string;
        total_points: number;
        public_submissions: number;
      }>>`
        SELECT handle, total_points, public_submissions
        FROM leaderboard_totals
        ORDER BY total_points DESC
        LIMIT 10
      `;

      expect(leaderboard.length).toBeGreaterThan(0);
      expect(leaderboard[0].total_points).toBeGreaterThan(0);
      expect(leaderboard[0].public_submissions).toBeGreaterThan(0);
    }));

    it('should query leaderboard views efficiently under load', withTestDatabase(async (db) => {
      // Create moderate dataset
      const users = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `queryuser${i}`,
            name: `Query User ${i}`,
          })
        )
      );

      for (const user of users) {
        await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.APPROVED,
          visibility: Visibility.PUBLIC,
        });

        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: Math.floor(Math.random() * 50) + 10,
        });
      }

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      // Benchmark concurrent queries
      const concurrentQueries = 10;
      const queryPromises = Array.from({ length: concurrentQueries }, async () => {
        const start = Date.now();
        
        const result = await db.prisma.$queryRaw<Array<{
          handle: string;
          total_points: number;
        }>>`
          SELECT handle, total_points
          FROM leaderboard_totals
          ORDER BY total_points DESC
          LIMIT 20
        `;
        
        return {
          duration: Date.now() - start,
          resultCount: result.length,
        };
      });

      const results = await Promise.all(queryPromises);
      
      const avgQueryTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxQueryTime = Math.max(...results.map(r => r.duration));

      logger.database({
        operation: 'CONCURRENT_QUERY_BENCHMARK',
        table: 'leaderboard_totals',
        duration: maxQueryTime,
        recordCount: concurrentQueries,
        metadata: {
          avgQueryTime,
          maxQueryTime,
          concurrentQueries,
        },
      });

      // Performance requirements for concurrent queries
      expect(avgQueryTime).toBeLessThan(200); // Average under 200ms
      expect(maxQueryTime).toBeLessThan(500); // Max under 500ms
      
      // All queries should return results
      results.forEach(result => {
        expect(result.resultCount).toBeGreaterThan(0);
      });
    }));

    it('should handle 30-day leaderboard calculations efficiently', withTestDatabase(async (db) => {
      const users = await Promise.all(
        Array.from({ length: 30 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `timeuser${i}`,
            name: `Time User ${i}`,
          })
        )
      );

      // Create points entries across different time periods
      const now = new Date();
      const timeRanges = [
        { daysAgo: 5, count: 10 },   // Recent activity
        { daysAgo: 15, count: 8 },   // Mid-range activity
        { daysAgo: 25, count: 6 },   // Older recent activity
        { daysAgo: 35, count: 4 },   // Outside 30-day window
      ];

      for (const user of users) {
        for (const timeRange of timeRanges) {
          for (let i = 0; i < timeRange.count; i++) {
            const createdAt = new Date(now.getTime() - (timeRange.daysAgo * 24 * 60 * 60 * 1000));
            
            await db.prisma.pointsLedger.create({
              data: {
                user_id: user.id,
                activity_code: 'LEARN',
                source: LedgerSource.FORM,
                delta_points: 20,
                created_at: createdAt,
              },
            });
          }
        }
      }

      const refreshStart = Date.now();
      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_30d`;
      const refreshTime = Date.now() - refreshStart;

      logger.database({
        operation: '30D_MV_REFRESH',
        table: 'leaderboard_30d',
        duration: refreshTime,
        recordCount: users.length,
        metadata: { totalPointsEntries: users.length * timeRanges.reduce((sum, tr) => sum + tr.count, 0) },
      });

      // Query the 30-day leaderboard
      const queryStart = Date.now();
      const leaderboard30d = await db.prisma.$queryRaw<Array<{
        handle: string;
        total_points: number;
      }>>`
        SELECT handle, total_points
        FROM leaderboard_30d
        ORDER BY total_points DESC
      `;
      const queryTime = Date.now() - queryStart;

      expect(refreshTime).toBeLessThan(5000); // Refresh under 5 seconds
      expect(queryTime).toBeLessThan(100); // Query under 100ms
      expect(leaderboard30d.length).toBeGreaterThan(0);
      
      // Verify that only recent activity is included
      // Each user should have points from 3 time ranges within 30 days
      const expectedPointsPerUser = (10 + 8 + 6) * 20; // (5+15+25 days ago) * 20 points
      const topUser = leaderboard30d[0];
      expect(topUser.total_points).toBe(expectedPointsPerUser);
    }));
  });

  describe('Complex Query Performance', () => {
    it('should handle submission filtering efficiently', withTestDatabase(async (db) => {
      // Create test data with various statuses and visibility
      const users = await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `filteruser${i}`,
            name: `Filter User ${i}`,
          })
        )
      );

      const statuses = [SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED];
      const visibilities = [Visibility.PUBLIC, Visibility.PRIVATE];
      const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'];

      for (const user of users) {
        for (let i = 0; i < 5; i++) {
          await db.fixtures.createTestSubmission({
            user_id: user.id,
            activity_code: activities[i],
            status: statuses[i % statuses.length],
            visibility: visibilities[i % visibilities.length],
          });
        }
      }

      // Benchmark various filtered queries
      const queries = [
        {
          name: 'pending_submissions',
          query: () => db.prisma.submission.findMany({
            where: { status: SubmissionStatus.PENDING },
            include: { user: true, activity: true },
          }),
        },
        {
          name: 'public_approved_submissions',
          query: () => db.prisma.submission.findMany({
            where: { 
              status: SubmissionStatus.APPROVED,
              visibility: Visibility.PUBLIC,
            },
            include: { user: true },
          }),
        },
        {
          name: 'user_submission_count',
          query: () => db.prisma.submission.groupBy({
            by: ['user_id'],
            _count: { id: true },
            where: { status: SubmissionStatus.APPROVED },
          }),
        },
        {
          name: 'activity_statistics',
          query: () => db.prisma.submission.groupBy({
            by: ['activity_code', 'status'],
            _count: { id: true },
          }),
        },
      ];

      const results = await Promise.all(
        queries.map(async ({ name, query }) => {
          const start = Date.now();
          const result = await query();
          const duration = Date.now() - start;
          
          return { name, duration, resultCount: Array.isArray(result) ? result.length : 0 };
        })
      );

      results.forEach(({ name, duration, resultCount }) => {
        logger.database({
          operation: `FILTER_QUERY_${name.toUpperCase()}`,
          table: 'submissions',
          duration,
          recordCount: resultCount,
        });

        // All queries should complete within reasonable time
        expect(duration).toBeLessThan(1000); // Under 1 second
        expect(resultCount).toBeGreaterThan(0);
      });
    }));

    it('should handle points aggregation queries efficiently', withTestDatabase(async (db) => {
      const users = await Promise.all(
        Array.from({ length: 25 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `pointsuser${i}`,
            name: `Points User ${i}`,
          })
        )
      );

      const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT'];
      
      for (const user of users) {
        for (const activity of activities) {
          // Create multiple point entries per user per activity
          for (let i = 0; i < 3; i++) {
            await db.fixtures.createPointsEntry({
              user_id: user.id,
              activity_code: activity,
              delta_points: Math.floor(Math.random() * 50) + 10,
              source: i === 0 ? LedgerSource.FORM : i === 1 ? LedgerSource.WEBHOOK : LedgerSource.MANUAL,
            });
          }
        }
      }

      // Benchmark aggregation queries
      const aggregationQueries = [
        {
          name: 'user_total_points',
          query: () => db.prisma.pointsLedger.groupBy({
            by: ['user_id'],
            _sum: { delta_points: true },
            orderBy: { _sum: { delta_points: 'desc' } },
          }),
        },
        {
          name: 'activity_point_totals',
          query: () => db.prisma.pointsLedger.groupBy({
            by: ['activity_code'],
            _sum: { delta_points: true },
            _avg: { delta_points: true },
            _count: { id: true },
          }),
        },
        {
          name: 'source_breakdown',
          query: () => db.prisma.pointsLedger.groupBy({
            by: ['source'],
            _sum: { delta_points: true },
            _count: { id: true },
          }),
        },
        {
          name: 'top_users_with_details',
          query: () => db.prisma.user.findMany({
            select: {
              id: true,
              handle: true,
              name: true,
              ledger: {
                select: { delta_points: true },
              },
            },
            take: 10,
          }),
        },
      ];

      const aggregationResults = await Promise.all(
        aggregationQueries.map(async ({ name, query }) => {
          const start = Date.now();
          const result = await query();
          const duration = Date.now() - start;
          
          return { name, duration, resultCount: Array.isArray(result) ? result.length : 0 };
        })
      );

      aggregationResults.forEach(({ name, duration, resultCount }) => {
        logger.database({
          operation: `AGGREGATION_${name.toUpperCase()}`,
          table: 'points_ledger',
          duration,
          recordCount: resultCount,
        });

        // Aggregation queries should be reasonably fast
        expect(duration).toBeLessThan(500); // Under 500ms
        expect(resultCount).toBeGreaterThan(0);
      });
    }));
  });

  describe('Bulk Operations Performance', () => {
    it('should handle batch inserts efficiently', withTestDatabase(async (db) => {
      const batchSizes = [10, 50, 100];
      
      for (const batchSize of batchSizes) {
        const user = await db.fixtures.createTestUser({
          handle: `batchuser${batchSize}`,
          name: `Batch User ${batchSize}`,
        });

        const start = Date.now();

        // Create batch of points entries
        const pointsData = Array.from({ length: batchSize }, () => ({
          user_id: user.id,
          activity_code: 'LEARN',
          source: LedgerSource.FORM,
          delta_points: Math.floor(Math.random() * 50) + 1,
        }));

        await db.prisma.pointsLedger.createMany({
          data: pointsData,
        });

        const duration = Date.now() - start;

        logger.database({
          operation: 'BATCH_INSERT',
          table: 'points_ledger',
          duration,
          recordCount: batchSize,
          metadata: { batchSize, avgTimePerRecord: duration / batchSize },
        });

        // Batch operations should be efficient
        expect(duration).toBeLessThan(batchSize * 10); // Less than 10ms per record
        expect(duration / batchSize).toBeLessThan(20); // Less than 20ms per record

        // Verify all records were created
        const createdCount = await db.prisma.pointsLedger.count({
          where: { user_id: user.id },
        });
        expect(createdCount).toBe(batchSize);
      }
    }));

    it('should handle concurrent write operations', withTestDatabase(async (db) => {
      const concurrentUsers = 10;
      const entriesPerUser = 5;

      // Create users first
      const users = await Promise.all(
        Array.from({ length: concurrentUsers }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `concurrentuser${i}`,
            name: `Concurrent User ${i}`,
          })
        )
      );

      const start = Date.now();

      // Create concurrent operations
      const concurrentOps = users.map(async (user) => {
        const ops = Array.from({ length: entriesPerUser }, () => 
          db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: 'EXPLORE',
            delta_points: 50,
          })
        );
        return Promise.all(ops);
      });

      await Promise.all(concurrentOps);
      const duration = Date.now() - start;

      logger.database({
        operation: 'CONCURRENT_WRITES',
        table: 'points_ledger',
        duration,
        recordCount: concurrentUsers * entriesPerUser,
        metadata: {
          concurrentUsers,
          entriesPerUser,
          totalOperations: concurrentUsers * entriesPerUser,
        },
      });

      // Concurrent operations should complete within reasonable time
      expect(duration).toBeLessThan(5000); // Under 5 seconds

      // Verify all records were created
      const totalRecords = await db.prisma.pointsLedger.count({
        where: {
          user_id: { in: users.map(u => u.id) },
          activity_code: 'EXPLORE',
        },
      });
      expect(totalRecords).toBe(concurrentUsers * entriesPerUser);
    }));
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large result sets without memory issues', withTestDatabase(async (db) => {
      // Create a substantial dataset
      const users = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          db.fixtures.createTestUser({
            handle: `memuser${i}`,
            name: `Memory Test User ${i}`,
          })
        )
      );

      // Create many points entries
      const entriesPerUser = 20;
      for (const user of users) {
        const entries = Array.from({ length: entriesPerUser }, (_, i) => ({
          user_id: user.id,
          activity_code: ['LEARN', 'EXPLORE', 'AMPLIFY'][i % 3],
          source: LedgerSource.FORM,
          delta_points: Math.floor(Math.random() * 100) + 1,
        }));

        await db.prisma.pointsLedger.createMany({ data: entries });
      }

      const start = Date.now();

      // Query large result set
      const allPoints = await db.prisma.pointsLedger.findMany({
        include: {
          user: {
            select: { id: true, handle: true, name: true },
          },
          activity: true,
        },
      });

      const duration = Date.now() - start;

      logger.database({
        operation: 'LARGE_RESULT_SET',
        table: 'points_ledger',
        duration,
        recordCount: allPoints.length,
        metadata: {
          expectedRecords: users.length * entriesPerUser,
          actualRecords: allPoints.length,
          includesJoins: true,
        },
      });

      // Should handle large queries within reasonable time
      expect(duration).toBeLessThan(2000); // Under 2 seconds
      expect(allPoints.length).toBe(users.length * entriesPerUser);
      
      // Verify data integrity
      expect(allPoints[0]).toHaveProperty('user');
      expect(allPoints[0]).toHaveProperty('activity');
      expect(allPoints[0].user).toHaveProperty('handle');
    }));
  });

  describe('Indonesian Context Performance', () => {
    it('should handle Indonesian text searches efficiently', withTestDatabase(async (db) => {
      // Create users with Indonesian names and schools
      const indonesianUsers = await Promise.all([
        db.fixtures.createTestUser({
          name: 'Sari Dewi Kusumawati',
          school: 'SMAN 1 Jakarta Pusat',
          cohort: 'MS Elevate Jakarta 2024',
        }),
        db.fixtures.createTestUser({
          name: 'Budi Santoso Pratama',
          school: 'SMP Negeri 12 Surabaya',
          cohort: 'MS Elevate Surabaya 2024',
        }),
        db.fixtures.createTestUser({
          name: 'Dewi Lestari Handayani',
          school: 'SMK Telkom Bandung',
          cohort: 'MS Elevate Bandung 2024',
        }),
      ]);

      // Create submissions with Indonesian content
      for (const user of indonesianUsers) {
        await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'EXPLORE',
          payload: {
            title: 'Implementasi AI dalam Pembelajaran Bahasa Indonesia',
            description: 'Menggunakan ChatGPT untuk membantu siswa menulis esai dan menganalisis teks sastra.',
            reflection: 'Siswa menunjukkan antusiasme tinggi dan hasil belajar yang meningkat signifikan.',
          },
        });

        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'EXPLORE',
          delta_points: 50,
        });
      }

      await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`;

      // Benchmark Indonesian text queries
      const searchQueries = [
        {
          name: 'name_search',
          query: () => db.prisma.user.findMany({
            where: {
              OR: [
                { name: { contains: 'Dewi', mode: 'insensitive' } },
                { name: { contains: 'Sari', mode: 'insensitive' } },
              ],
            },
          }),
        },
        {
          name: 'school_search',
          query: () => db.prisma.user.findMany({
            where: {
              school: { contains: 'Jakarta', mode: 'insensitive' },
            },
          }),
        },
        {
          name: 'cohort_search',
          query: () => db.prisma.user.findMany({
            where: {
              cohort: { contains: 'MS Elevate', mode: 'insensitive' },
            },
          }),
        },
      ];

      const searchResults = await Promise.all(
        searchQueries.map(async ({ name, query }) => {
          const start = Date.now();
          const result = await query();
          const duration = Date.now() - start;
          
          return { name, duration, resultCount: result.length };
        })
      );

      searchResults.forEach(({ name, duration, resultCount }) => {
        logger.database({
          operation: `INDONESIAN_SEARCH_${name.toUpperCase()}`,
          table: 'users',
          duration,
          recordCount: resultCount,
          metadata: { searchType: name },
        });

        // Indonesian text searches should be efficient
        expect(duration).toBeLessThan(200); // Under 200ms
        expect(resultCount).toBeGreaterThan(0);
      });
    }));
  });
});
