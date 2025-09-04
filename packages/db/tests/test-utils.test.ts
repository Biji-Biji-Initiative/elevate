/**
 * Test Utilities and Common Patterns Tests
 * Tests the test utilities themselves and demonstrates common testing patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TestDatabase,
  DatabaseAssertions,
  PerformanceHelper,
  withTestDatabase,
} from './helpers'
//
import { getSecureLogger } from '../src/logger'
import { SubmissionStatus, Visibility, Role } from '@prisma/client'

describe('Test Utilities and Common Patterns', () => {
  let testDb: TestDatabase
  let assertions: DatabaseAssertions
  let perfHelper: PerformanceHelper
  const logger = getSecureLogger()

  beforeEach(async () => {
    testDb = new TestDatabase()
    await testDb.setup()
    assertions = new DatabaseAssertions(testDb.prisma)
    perfHelper = new PerformanceHelper(testDb.prisma)
  })

  afterEach(async () => {
    await testDb.cleanup()
  })

  describe('DatabaseFixtures Testing', () => {
    it(
      'should generate consistent Indonesian user data',
      withTestDatabase(async (db) => {
        const users = await Promise.all(
          Array.from({ length: 10 }, () => db.fixtures.generateUser()),
        )

        // Verify Indonesian names are used
        const hasIndonesianNames = users.every((user) => {
          const indonesianNames = [
            'Sari Dewi',
            'Budi Santoso',
            'Rina Kusumawati',
            'Ahmad Fauzi',
            'Indah Sari',
            'Eko Prasetyo',
            'Dewi Lestari',
            'Rahmat Hidayat',
            'Sri Wahyuni',
            'Agung Setiawan',
            'Maya Sari',
            'Dimas Pratama',
            'Fitri Handayani',
            'Joko Widodo',
            'Ani Yulianti',
            'Bambang Sutrisno',
            'Ratna Sari',
            'Hendra Wijaya',
            'Lilis Suryani',
            'Gunawan Sasongko',
          ]
          return indonesianNames.includes(user.name)
        })

        expect(hasIndonesianNames).toBe(true)

        // Verify Indonesian schools are used
        const hasIndonesianSchools = users.every((user) => {
          const schoolName = user.school || ''
          return (
            schoolName.includes('SMAN') ||
            schoolName.includes('SMP') ||
            schoolName.includes('SMK')
          )
        })

        expect(hasIndonesianSchools).toBe(true)

        // Verify Indonesian email domains
        const hasIndonesianEmails = users.every((user) => {
          return user.email.endsWith('.edu.id')
        })

        expect(hasIndonesianEmails).toBe(true)

        // Verify MS Elevate cohorts
        const hasMSElevateCohorts = users.every((user) => {
          const cohort = user.cohort || ''
          return cohort.includes('MS Elevate') && cohort.includes('2024')
        })

        expect(hasMSElevateCohorts).toBe(true)

        logger.database({
          operation: 'FIXTURE_VALIDATION',
          table: 'test_fixtures',
          duration: 0,
          recordCount: users.length,
          metadata: {
            indonesian_names: hasIndonesianNames,
            indonesian_schools: hasIndonesianSchools,
            indonesian_emails: hasIndonesianEmails,
            ms_elevate_cohorts: hasMSElevateCohorts,
          },
        })
      }),
    )

    it(
      'should generate realistic LEAPS activity payloads',
      withTestDatabase((db) => {
        const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']

        for (const activity of activities) {
          const payload = db.fixtures.generatePayloadForActivity(activity)

          switch (activity) {
            case 'LEARN':
              expect(payload).toHaveProperty('certificate_url')
              expect(payload).toHaveProperty('course_name')
              expect(payload).toHaveProperty('completion_date')
              expect(payload).toHaveProperty('certificate_hash')
              break

            case 'EXPLORE':
              expect(payload).toHaveProperty('title')
              expect(payload).toHaveProperty('description')
              expect(payload).toHaveProperty('ai_tools_used')
              expect(payload).toHaveProperty('students_trained')
              expect(payload).toHaveProperty('reflection')

              // Verify Indonesian context
              const explorePayload = payload as Record<string, unknown>
              expect(explorePayload.title).toContain('pembelajaran')
              expect(explorePayload.reflection).toContain('siswa')
              break

            case 'AMPLIFY':
              expect(payload).toHaveProperty('training_type')
              expect(payload).toHaveProperty('peers_trained')
              expect(payload).toHaveProperty('students_trained')
              expect(payload).toHaveProperty('training_topic')

              // Verify Indonesian context
              const amplifyPayload = payload as Record<string, unknown>
              expect(amplifyPayload.training_topic).toContain('Pembelajaran')
              expect(amplifyPayload.impact_description).toContain('rekan')
              break

            case 'PRESENT':
              expect(payload).toHaveProperty('linkedin_url')
              expect(payload).toHaveProperty('post_content')
              expect(payload).toHaveProperty('screenshot_url')
              expect(payload).toHaveProperty('engagement_metrics')

              // Verify Indonesian LinkedIn content
              const presentPayload = payload as Record<string, unknown>
              expect(presentPayload.post_content).toContain('MS Elevate')
              expect(presentPayload.post_content).toContain(
                '#MSElevateIndonesia',
              )
              break

            case 'SHINE':
              expect(payload).toHaveProperty('idea_title')
              expect(payload).toHaveProperty('description')
              expect(payload).toHaveProperty('innovation_category')
              expect(payload).toHaveProperty('potential_impact')

              // Verify Indonesian innovation context
              const shinePayload = payload as Record<string, unknown>
              expect(shinePayload.potential_impact).toContain('guru')
              expect(shinePayload.implementation_plan).toContain('Fase')
              break
          }
        }
      }),
    )

    it(
      'should create complete test scenarios',
      withTestDatabase(async (db) => {
        const scenarios = [
          'basic',
          'leaderboard',
          'review_queue',
          'comprehensive',
        ]

        for (const scenarioName of scenarios) {
          await db.fixtures.cleanup() // Clean between scenarios

          const scenario = await db.fixtures.createTestScenario(scenarioName)

          expect(scenario).toHaveProperty('users')
          expect(scenario).toHaveProperty('submissions')
          expect(scenario).toHaveProperty('pointsEntries')

          expect(scenario.users.length).toBeGreaterThan(0)

          // Verify scenario-specific characteristics
          switch (scenarioName) {
            case 'basic':
              expect(scenario.users).toHaveLength(1)
              expect(scenario.submissions).toHaveLength(1)
              expect(scenario.pointsEntries).toHaveLength(1)
              break

            case 'leaderboard':
              expect(scenario.users).toHaveLength(5)
              expect(scenario.submissions.length).toBeGreaterThan(5)
              expect(scenario.pointsEntries.length).toBeGreaterThan(5)
              break

            case 'review_queue':
              expect(scenario.users).toHaveLength(2) // 1 participant + 1 reviewer
              expect(scenario.submissions).toHaveLength(5) // All LEAPS stages
              expect(
                scenario.submissions.some(
                  (s) => s.status === SubmissionStatus.PENDING,
                ),
              ).toBe(true)
              expect(
                scenario.submissions.some(
                  (s) => s.status === SubmissionStatus.APPROVED,
                ),
              ).toBe(true)
              expect(
                scenario.submissions.some(
                  (s) => s.status === SubmissionStatus.REJECTED,
                ),
              ).toBe(true)
              break

            case 'comprehensive':
              expect(scenario.users.length).toBeGreaterThan(5)
              expect(scenario.submissions.length).toBeGreaterThan(10)
              expect(scenario.pointsEntries.length).toBeGreaterThan(10)
              break
          }

          logger.database({
            operation: `SCENARIO_${scenarioName.toUpperCase()}`,
            table: 'test_scenarios',
            duration: 0,
            recordCount: scenario.users.length,
            metadata: {
              users: scenario.users.length,
              submissions: scenario.submissions.length,
              points_entries: scenario.pointsEntries.length,
            },
          })
        }
      }),
    )

    it(
      'should handle fixture statistics accurately',
      withTestDatabase(async (db) => {
        // Create known data set
        await Promise.all([
          db.fixtures.createTestUser({ handle: 'stats1' }),
          db.fixtures.createTestUser({ handle: 'stats2' }),
          db.fixtures.createTestUser({ handle: 'stats3' }),
        ])

        const user = await db.fixtures.createTestUser({ handle: 'stats-main' })

        await Promise.all([
          db.fixtures.createTestSubmission({
            user_id: user.id,
            activity_code: 'LEARN',
          }),
          db.fixtures.createTestSubmission({
            user_id: user.id,
            activity_code: 'EXPLORE',
          }),
        ])

        await Promise.all([
          db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: 'LEARN',
            delta_points: 20,
          }),
          db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: 'EXPLORE',
            delta_points: 50,
          }),
        ])

        const stats = await db.fixtures.getStats()

        expect(stats.users).toBe(4)
        expect(stats.submissions).toBe(2)
        expect(stats.pointsEntries).toBe(2)
        expect(stats.totalPoints).toBe(70)
      }),
    )
  })

  describe('DatabaseAssertions Testing', () => {
    it(
      'should validate all assertion methods',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser({
          handle: 'assertion-test',
          name: 'Assertion Test User',
        })

        const reviewer = await db.fixtures.createTestUser({
          role: Role.REVIEWER,
          handle: 'assertion-reviewer',
        })

        const submission = await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.APPROVED,
          reviewer_id: reviewer.id,
        })

        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
        })

        await db.prisma.earnedBadge.create({
          data: {
            user_id: user.id,
            badge_code: 'FIRST_STEPS',
          },
        })

        await db.prisma.auditLog.create({
          data: {
            actor_id: reviewer.id,
            action: 'TEST_ACTION',
            target_id: submission.id!,
            meta: { test: true },
          },
        })

        // Test all assertions
        await assertions.assertUserExists(user.id)
        await assertions.assertSubmissionExists(submission.id!)
        await assertions.assertPointsBalance(user.id, 20)
        await assertions.assertSubmissionStatus(submission.id!, 'APPROVED')
        await assertions.assertAuditLogExists(
          reviewer.id,
          'TEST_ACTION',
          submission.id!,
        )
        await assertions.assertBadgeEarned(user.id, 'FIRST_STEPS')

        // Test assertion failures
        await expect(
          assertions.assertUserExists('non-existent-user'),
        ).rejects.toThrow('does not exist')

        await expect(
          assertions.assertPointsBalance(user.id, 999),
        ).rejects.toThrow('Expected 999 points')

        await expect(
          assertions.assertSubmissionStatus(submission.id!, 'REJECTED'),
        ).rejects.toThrow('Expected submission')

        await expect(
          assertions.assertBadgeEarned(user.id, 'NON_EXISTENT_BADGE'),
        ).rejects.toThrow('has not earned badge')
      }),
    )
  })

  describe('PerformanceHelper Testing', () => {
    it(
      'should measure query performance accurately',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser()

        const { result, duration } = await perfHelper.measureQuery(async () => {
          return await db.prisma.user.findUnique({
            where: { id: user.id },
          })
        })

        expect(result).toBeTruthy()
        expect(result!.id).toBe(user.id)
        expect(duration).toBeGreaterThan(0)
        expect(duration).toBeLessThan(1000) // Should be fast for simple query
      }),
    )

    it(
      'should benchmark leaderboard performance',
      withTestDatabase(async (db) => {
        // Create test data for benchmarking
        const users = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            db.fixtures.createTestUser({
              handle: `benchmark${i}`,
              name: `Benchmark User ${i}`,
            }),
          ),
        )

        for (const user of users) {
          await db.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: 'LEARN',
            delta_points: Math.floor(Math.random() * 100) + 1,
          })
        }

        const benchmark = await perfHelper.benchmarkLeaderboard(5)

        expect(benchmark.results).toHaveLength(5)
        expect(benchmark.avgDuration).toBeGreaterThan(0)
        expect(benchmark.minDuration).toBeGreaterThan(0)
        expect(benchmark.maxDuration).toBeGreaterThan(0)
        expect(benchmark.minDuration).toBeLessThanOrEqual(benchmark.avgDuration)
        expect(benchmark.avgDuration).toBeLessThanOrEqual(benchmark.maxDuration)

        // Performance should be reasonable
        expect(benchmark.avgDuration).toBeLessThan(500) // Average under 500ms
        expect(benchmark.maxDuration).toBeLessThan(1000) // Max under 1 second

        logger.database({
          operation: 'LEADERBOARD_BENCHMARK',
          table: 'performance_test',
          duration: benchmark.maxDuration,
          recordCount: 5,
          metadata: {
            avg_duration: benchmark.avgDuration,
            min_duration: benchmark.minDuration,
            max_duration: benchmark.maxDuration,
            test_users: users.length,
          },
        })
      }),
    )
  })

  describe('TestDatabase Utilities', () => {
    it(
      'should handle database transactions properly',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser({
          handle: 'transaction-test',
        })

        // Test successful transaction
        const result = await db.withTransaction(async (tx) => {
          const submission = await tx.submission.create({
            data: {
              user_id: user.id,
              activity_code: 'LEARN',
              payload: { test: true },
            },
          })
          return submission
        }, false) // Don't rollback

        expect(result).toBeTruthy()

        // Test rollback transaction (for testing purposes)
        const rollbackResult = await db.withTransaction(async (tx) => {
          await tx.submission.create({
            data: {
              user_id: user.id,
              activity_code: 'EXPLORE',
              payload: { test: true },
            },
          })
          return 'should-be-rolled-back'
        }, true) // Force rollback

        expect(rollbackResult).toBeNull() // Rollback returns null

        // Verify only first submission exists
        const submissions = await db.prisma.submission.findMany({
          where: { user_id: user.id },
        })
        expect(submissions).toHaveLength(1)
        expect(submissions[0].activity_code).toBe('LEARN')
      }),
    )

    it(
      'should provide accurate health check information',
      withTestDatabase(async (db) => {
        const health = await db.healthCheck()

        expect(health.connected).toBe(true)
        expect(health.latency).toBeGreaterThan(0)
        expect(health.latency).toBeLessThan(1000) // Should be reasonably fast
        expect(health.tables).toBeInstanceOf(Array)
        expect(health.tables.length).toBeGreaterThan(0)

        // Check that expected tables are present
        const expectedTables = [
          'users',
          'activities',
          'submissions',
          'points_ledger',
        ]
        expectedTables.forEach((table) => {
          expect(health.tables).toContain(table)
        })
      }),
    )

    it(
      'should handle wait for completion correctly',
      withTestDatabase(async (db) => {
        const start = Date.now()
        await db.waitForCompletion(1000) // Wait up to 1 second
        const duration = Date.now() - start

        // Should complete quickly for healthy database
        expect(duration).toBeLessThan(1000)
      }),
    )
  })

  describe('Common Testing Patterns', () => {
    it(
      'should demonstrate user creation and verification pattern',
      withTestDatabase(async (db) => {
        // Pattern: Create user with Indonesian context
        const userData = {
          name: 'Sari Dewi Kusumawati',
          email: 'sari.dewi@sman1jakarta.edu.id',
          handle: 'saridewi',
          school: 'SMAN 1 Jakarta',
          cohort: 'MS Elevate Jakarta 2024',
        }

        const user = await db.fixtures.createTestUser(userData)

        // Pattern: Verify user creation
        await assertions.assertUserExists(user.id)
        expect(user.name).toBe(userData.name)
        expect(user.email).toBe(userData.email)
        expect(user.school).toBe(userData.school)

        // Pattern: Test user uniqueness
        await expect(
          db.fixtures.createTestUser({
            handle: userData.handle, // Duplicate handle
            email: 'different@email.com',
          }),
        ).rejects.toThrow() // Should fail due to unique constraint
      }),
    )

    it(
      'should demonstrate submission workflow pattern',
      withTestDatabase(async (db) => {
        // Pattern: Setup users
        const participant = await db.fixtures.createTestUser({
          role: Role.PARTICIPANT,
        })
        const reviewer = await db.fixtures.createTestUser({
          role: Role.REVIEWER,
        })

        // Pattern: Create pending submission
        const submission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'EXPLORE',
          status: SubmissionStatus.PENDING,
        })

        await assertions.assertSubmissionStatus(submission.id!, 'PENDING')

        // Pattern: Reviewer approves submission
        await db.prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            reviewer_id: reviewer.id,
            review_note: 'Approved after thorough review',
          },
        })

        await assertions.assertSubmissionStatus(submission.id!, 'APPROVED')

        // Pattern: Award points and verify
        await db.fixtures.createPointsEntry({
          user_id: participant.id,
          activity_code: 'EXPLORE',
          delta_points: 50,
        })

        await assertions.assertPointsBalance(participant.id, 50)

        // Pattern: Create audit trail
        await db.prisma.auditLog.create({
          data: {
            actor_id: reviewer.id,
            action: 'SUBMISSION_APPROVED',
            target_id: submission.id!,
            meta: {
              activity: 'EXPLORE',
              points_awarded: 50,
            },
          },
        })

        await assertions.assertAuditLogExists(
          reviewer.id,
          'SUBMISSION_APPROVED',
        )
      }),
    )

    it(
      'should demonstrate leaderboard testing pattern',
      withTestDatabase(async (db) => {
        // Pattern: Create multiple users with different point totals
        await Promise.all(
          [
            {
              user: await db.fixtures.createTestUser({
                handle: 'leader1',
                name: 'Top Performer',
              }),
              points: 150,
            },
            {
              user: await db.fixtures.createTestUser({
                handle: 'leader2',
                name: 'Second Place',
              }),
              points: 120,
            },
            {
              user: await db.fixtures.createTestUser({
                handle: 'leader3',
                name: 'Third Place',
              }),
              points: 90,
            },
          ].map(async ({ user, points }) => {
            // Award points
            await db.fixtures.createPointsEntry({
              user_id: user.id,
              activity_code: 'LEARN',
              delta_points: points,
            })

            // Create public submission for leaderboard visibility
            await db.fixtures.createTestSubmission({
              user_id: user.id,
              activity_code: 'LEARN',
              status: SubmissionStatus.APPROVED,
              visibility: Visibility.PUBLIC,
            })

            return { user, points }
          }),
        )

        // Pattern: Refresh materialized view
        await db.prisma
          .$executeRaw`REFRESH MATERIALIZED VIEW leaderboard_totals`

        // Pattern: Query and verify leaderboard order
        const leaderboard = await db.prisma.$queryRaw<
          Array<{
            handle: string
            total_points: number
            name: string
          }>
        >`
        SELECT handle, total_points, name
        FROM leaderboard_totals
        ORDER BY total_points DESC
      `

        expect(leaderboard).toHaveLength(3)
        expect(leaderboard[0].handle).toBe('leader1')
        expect(leaderboard[0].total_points).toBe(150)
        expect(leaderboard[1].handle).toBe('leader2')
        expect(leaderboard[1].total_points).toBe(120)
        expect(leaderboard[2].handle).toBe('leader3')
        expect(leaderboard[2].total_points).toBe(90)
      }),
    )

    it(
      'should demonstrate error handling and recovery pattern',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser()

        // Pattern: Test constraint violation handling
        try {
          await db.prisma.user.create({
            data: {
              id: 'duplicate-test',
              handle: user.handle, // This should violate unique constraint
              name: 'Duplicate Handle User',
              email: 'duplicate@test.com',
            },
          })

          // Should not reach here
          expect(false).toBe(true)
        } catch (error) {
          // Pattern: Verify expected error occurred
          expect(error).toBeTruthy()

          // Pattern: Log error securely
          const secureLogger = getSecureLogger()
          secureLogger.error('Expected constraint violation', error as Error)
        }

        // Pattern: Verify database state is consistent
        const userCount = await db.prisma.user.count({
          where: { handle: user.handle },
        })
        expect(userCount).toBe(1) // Only original user should exist
      }),
    )

    it(
      'should demonstrate performance testing pattern',
      withTestDatabase(async (db) => {
        // Pattern: Create test data set
        const userCount = 50
        const users = await Promise.all(
          Array.from({ length: userCount }, (_, i) =>
            db.fixtures.createTestUser({
              handle: `perftest${i}`,
              name: `Performance User ${i}`,
            }),
          ),
        )

        // Pattern: Measure bulk operation performance
        const start = Date.now()

        await Promise.all(
          users.map((user) =>
            db.fixtures.createPointsEntry({
              user_id: user.id,
              activity_code: 'LEARN',
              delta_points: Math.floor(Math.random() * 100) + 1,
            }),
          ),
        )

        const bulkDuration = Date.now() - start

        // Pattern: Verify performance requirements
        expect(bulkDuration).toBeLessThan(5000) // Under 5 seconds
        expect(bulkDuration / userCount).toBeLessThan(100) // Less than 100ms per user

        // Pattern: Measure query performance
        const queryStart = Date.now()

        const pointsTotal = await db.prisma.pointsLedger.aggregate({
          _sum: { delta_points: true },
          _count: { id: true },
        })

        const queryDuration = Date.now() - queryStart

        expect(queryDuration).toBeLessThan(1000) // Under 1 second
        expect(pointsTotal._count.id).toBe(userCount)
        expect(pointsTotal._sum.delta_points).toBeGreaterThan(0)
      }),
    )
  })
})
