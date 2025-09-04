/**
 * Database test utilities and helpers
 * Provides common functionality for testing database operations
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseFixtures } from './fixtures';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for testing');
}

/**
 * Test database wrapper with automatic cleanup and isolation
 */
export class TestDatabase {
  public prisma: PrismaClient;
  public fixtures: DatabaseFixtures;
  private isSetup = false;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'test' ? [] : ['query', 'error'],
    });
    this.fixtures = new DatabaseFixtures(this.prisma);
  }

  /**
   * Setup test database with seed data
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      await this.prisma.$connect();
      await this.seedActivities();
      await this.seedBadges();
      this.isSetup = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('Failed to setup test database:', err.message)
      throw err;
    }
  }

  /**
   * Clean up test database
   */
  async cleanup(): Promise<void> {
    if (!this.isSetup) return;

    try {
      await this.fixtures.cleanup();
      await this.prisma.$disconnect();
      this.isSetup = false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('Failed to cleanup test database:', err.message)
      throw err;
    }
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    await this.cleanup();
    await this.setup();
  }

  /**
   * Seed activities table
   */
  private async seedActivities(): Promise<void> {
    const activities = [
      { code: 'LEARN', name: 'Learn', default_points: 20 },
      { code: 'EXPLORE', name: 'Explore', default_points: 50 },
      { code: 'AMPLIFY', name: 'Amplify', default_points: 25 },
      { code: 'PRESENT', name: 'Present', default_points: 20 },
      { code: 'SHINE', name: 'Shine', default_points: 0 },
    ];

    for (const activity of activities) {
      await this.prisma.activity.upsert({
        where: { code: activity.code },
        update: activity,
        create: activity,
      });
    }
  }

  /**
   * Seed badges table
   */
  private async seedBadges(): Promise<void> {
    const badges = [
      {
        code: 'FIRST_STEPS',
        name: 'First Steps',
        description: 'Completed your first LEAPS activity',
        criteria: { min_activities: 1 },
      },
      {
        code: 'EXPLORER',
        name: 'Explorer',
        description: 'Completed Explore activity',
        criteria: { required_activities: ['EXPLORE'] },
      },
      {
        code: 'MENTOR',
        name: 'Mentor',
        description: 'Trained 10 or more peers',
        criteria: { min_peer_training: 10 },
      },
      {
        code: 'INFLUENCER',
        name: 'Influencer',
        description: 'Posted on LinkedIn about AI education',
        criteria: { required_activities: ['PRESENT'] },
      },
      {
        code: 'INNOVATOR',
        name: 'Innovator',
        description: 'Submitted innovative AI education idea',
        criteria: { required_activities: ['SHINE'] },
      },
    ];

    for (const badge of badges) {
      await this.prisma.badge.upsert({
        where: { code: badge.code },
        update: badge,
        create: badge,
      });
    }
  }

  /**
   * Execute a transaction with automatic rollback on test failure
   */
  async withTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>,
    rollback = true
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await fn(tx);
      
      if (rollback && process.env.NODE_ENV === 'test') {
        // Force rollback in test environment
        throw new Error('TEST_ROLLBACK');
      }
      
      return result;
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === 'TEST_ROLLBACK') {
        // This is expected in tests
        return null as T;
      }
      throw error;
    });
  }

  /**
   * Wait for async operations to complete
   */
  async waitForCompletion(maxWait = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        // Use Prisma's built-in health check instead of raw SQL
        await this.prisma.$queryRaw`SELECT 1 as health_check`;
        await new Promise(resolve => setTimeout(resolve, 100));
        break;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    tables: string[];
  }> {
    const start = Date.now();
    
    try {
      // Test connection with a simple query
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      const connected = true;
      const latency = Date.now() - start;

      // Get table list using Prisma's introspection approach
      // Since we know our schema, we can list the main tables
      const tables = [
        'users', 'activities', 'submissions', 'points_ledger', 
        'badges', 'earned_badges', 'kajabi_events', 'audit_log'
      ];

      // Verify tables exist by checking if we can query them
      const existingTables: string[] = [];
      for (const table of tables) {
        try {
          switch (table) {
            case 'users':
              await this.prisma.user.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'activities':
              await this.prisma.activity.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'submissions':
              await this.prisma.submission.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'points_ledger':
              await this.prisma.pointsLedger.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'badges':
              await this.prisma.badge.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'earned_badges':
              await this.prisma.earnedBadge.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'kajabi_events':
              await this.prisma.kajabiEvent.findFirst({ take: 1 });
              existingTables.push(table);
              break;
            case 'audit_log':
              await this.prisma.auditLog.findFirst({ take: 1 });
              existingTables.push(table);
              break;
          }
        } catch {
          // Table doesn't exist or is not accessible
        }
      }

      return {
        connected,
        latency,
        tables: existingTables,
      };
    } catch (error) {
      return {
        connected: false,
        latency: -1,
        tables: [],
      };
    }
  }
}

/**
 * Create isolated test database instance
 */
export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}

/**
 * Test suite wrapper that handles setup/cleanup
 */
export function withTestDatabase(testFn: (db: TestDatabase) => Promise<void> | void) {
  return async () => {
    const db = createTestDatabase();
    
    try {
      await db.setup();
      await Promise.resolve(testFn(db));
    } finally {
      await db.cleanup();
    }
  };
}

/**
 * Assertion helpers for database testing
 */
export class DatabaseAssertions {
  constructor(private prisma: PrismaClient) {}

  async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} does not exist`);
    }
  }

  async assertSubmissionExists(submissionId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ 
      where: { id: submissionId } 
    });
    if (!submission) {
      throw new Error(`Submission ${submissionId} does not exist`);
    }
  }

  async assertPointsBalance(userId: string, expectedPoints: number): Promise<void> {
    const result = await this.prisma.pointsLedger.aggregate({
      where: { user_id: userId },
      _sum: { delta_points: true },
    });

    const actualPoints = result._sum.delta_points || 0;
    if (actualPoints !== expectedPoints) {
      throw new Error(
        `Expected ${expectedPoints} points for user ${userId}, got ${actualPoints}`
      );
    }
  }

  async assertSubmissionStatus(
    submissionId: string, 
    expectedStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ 
      where: { id: submissionId } 
    });
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} does not exist`);
    }
    
    if (submission.status !== expectedStatus) {
      throw new Error(
        `Expected submission ${submissionId} to have status ${expectedStatus}, got ${submission.status}`
      );
    }
  }

  async assertAuditLogExists(
    actorId: string, 
    action: string, 
    targetId?: string
  ): Promise<void> {
    const auditEntry = await this.prisma.auditLog.findFirst({
      where: {
        actor_id: actorId,
        action,
        ...(targetId && { target_id: targetId }),
      },
    });

    if (!auditEntry) {
      throw new Error(
        `Audit log entry not found for actor ${actorId}, action ${action}${
          targetId ? `, target ${targetId}` : ''
        }`
      );
    }
  }

  async assertBadgeEarned(userId: string, badgeCode: string): Promise<void> {
    const earnedBadge = await this.prisma.earnedBadge.findUnique({
      where: {
        user_id_badge_code: {
          user_id: userId,
          badge_code: badgeCode,
        },
      },
    });

    if (!earnedBadge) {
      throw new Error(`User ${userId} has not earned badge ${badgeCode}`);
    }
  }
}

/**
 * Performance testing helpers
 */
export class PerformanceHelper {
  constructor(private prisma: PrismaClient) {}

  async measureQuery<T>(queryFn: () => Promise<T>): Promise<{
    result: T;
    duration: number;
  }> {
    const start = process.hrtime.bigint();
    const result = await queryFn();
    const end = process.hrtime.bigint();
    
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  }

  async benchmarkLeaderboard(iterations = 10): Promise<{
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    results: number[];
  }> {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureQuery(async () => {
        // Use Prisma aggregation instead of raw SQL
        const usersWithPoints = await this.prisma.user.findMany({
          where: {
            role: 'PARTICIPANT'
          },
          select: {
            id: true,
            handle: true,
            name: true,
            ledger: {
              select: {
                delta_points: true
              }
            }
          },
          take: 20
        });
        
        // Calculate totals and sort
        return usersWithPoints
          .map(user => ({
            id: user.id,
            handle: user.handle,
            name: user.name,
            total_points: user.ledger.reduce((sum, entry) => sum + entry.delta_points, 0)
          }))
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 20);
      });
      
      results.push(duration);
    }

    return {
      avgDuration: results.reduce((a, b) => a + b, 0) / results.length,
      minDuration: Math.min(...results),
      maxDuration: Math.max(...results),
      results,
    };
  }
}

// Export singleton instance for common use
export const testDb = createTestDatabase();
