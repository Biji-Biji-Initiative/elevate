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
      console.error('Failed to setup test database:', error);
      throw error;
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
      console.error('Failed to cleanup test database:', error);
      throw error;
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
    }).catch((error) => {
      if (error.message === 'TEST_ROLLBACK') {
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
        await this.prisma.$executeRaw`SELECT 1`;
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
      await this.prisma.$executeRaw`SELECT 1`;
      const connected = true;
      const latency = Date.now() - start;

      // Get table list
      const tables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;

      return {
        connected,
        latency,
        tables: tables.map(t => t.table_name),
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
export function withTestDatabase(testFn: (db: TestDatabase) => Promise<void>) {
  return async () => {
    const db = createTestDatabase();
    
    try {
      await db.setup();
      await testFn(db);
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
        return this.prisma.$queryRaw`
          SELECT 
            u.id,
            u.handle,
            u.name,
            COALESCE(SUM(pl.delta_points), 0) as total_points
          FROM users u
          LEFT JOIN points_ledger pl ON u.id = pl.user_id
          GROUP BY u.id, u.handle, u.name
          ORDER BY total_points DESC
          LIMIT 20
        `;
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