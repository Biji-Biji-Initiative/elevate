/**
 * Performance Tests: Critical Queries and Endpoints
 * 
 * Tests performance characteristics:
 * 1. Database queries under load
 * 2. API endpoints response times
 * 3. Leaderboard calculation performance
 * 4. File upload throughput
 * 5. Concurrent request handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestDatabase, PerformanceHelper } from '../../packages/db/tests/helpers'
import { TestData, executeApiRoute, createMockRequest, mockAuthentication, clearAuthenticationMock } from '../helpers/test-server'

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  FAST_QUERY: 50,       // Database queries should be under 50ms
  API_RESPONSE: 200,    // API responses should be under 200ms  
  LEADERBOARD: 500,     // Leaderboard calculation should be under 500ms
  BULK_OPERATION: 2000, // Bulk operations should be under 2s
  CONCURRENT_LOAD: 1000 // Concurrent operations should complete under 1s
}

describe('Performance: Critical Queries and Endpoints', () => {
  let testDb: TestDatabase
  let performanceHelper: PerformanceHelper
  let testUsers: any[]
  let apiHandlers: any

  beforeEach(async () => {
    // Setup isolated test database
    testDb = new TestDatabase()
    await testDb.setup()
    performanceHelper = new PerformanceHelper(testDb.prisma)

    // Create test dataset for performance testing
    testUsers = []
    for (let i = 1; i <= 100; i++) {
      const user = await testDb.fixtures.createTestUser({
        handle: `perfuser${i}`,
        name: `Performance User ${i}`,
        email: `perfuser${i}@example.com`,
        role: i <= 10 ? 'REVIEWER' : 'PARTICIPANT' // 10% reviewers
      })
      testUsers.push(user)

      // Create varying amounts of data per user
      const submissionCount = Math.floor(Math.random() * 5) + 1
      const pointsTotal = 0
      
      for (let j = 0; j < submissionCount; j++) {
        const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
        const activity = activities[Math.floor(Math.random() * activities.length)]
        const status = Math.random() > 0.7 ? 'PENDING' : 'APPROVED'
        const visibility = status === 'APPROVED' && Math.random() > 0.5 ? 'PUBLIC' : 'PRIVATE'
        
        const submission = await testDb.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: activity,
          status,
          visibility
        })

        // Add points for approved submissions
        if (status === 'APPROVED') {
          const points = testDb.fixtures.getDefaultPointsForActivity(activity)
          await testDb.fixtures.createPointsEntry({
            user_id: user.id,
            activity_code: activity,
            delta_points: points
          })
        }
      }
    }

    // Mock API handlers
    vi.doMock('@elevate/db/client', () => ({
      prisma: testDb.prisma
    }))

    vi.doMock('@elevate/db', () => ({
      prisma: testDb.prisma
    }))

    // Import handlers after mocking
    apiHandlers = {
      leaderboard: (await import('../../apps/web/app/api/leaderboard/route')).GET,
      adminSubmissions: (await import('../../apps/admin/app/api/admin/submissions/route')).GET,
      dashboard: vi.fn().mockImplementation(async () => {
        const userSubmissions = await testDb.prisma.submission.findMany({
          where: { user_id: testUsers[0].id },
          include: {
            activity: true,
            attachments_rel: true
          },
          orderBy: { created_at: 'desc' }
        })

        const userPoints = await testDb.prisma.pointsLedger.aggregate({
          where: { user_id: testUsers[0].id },
          _sum: { delta_points: true }
        })

        return new Response(JSON.stringify({
          success: true,
          data: {
            submissions: userSubmissions,
            totalPoints: userPoints._sum.delta_points || 0
          }
        }))
      })
    }
  })

  afterEach(async () => {
    await testDb.cleanup()
    clearAuthenticationMock()
    vi.clearAllMocks()
  })

  describe('Database Query Performance', () => {
    it('should query users efficiently', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.user.findMany({
          take: 20,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            handle: true,
            name: true,
            email: true,
            school: true,
            role: true
          }
        })
      })

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY)
      expect(result).toHaveLength(20)
    })

    it('should query submissions with filters efficiently', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.submission.findMany({
          where: {
            status: 'PENDING',
            activity_code: 'LEARN'
          },
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
                email: true
              }
            },
            activity: true
          },
          orderBy: { created_at: 'desc' },
          take: 50
        })
      })

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should aggregate points efficiently', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.pointsLedger.groupBy({
          by: ['user_id'],
          _sum: {
            delta_points: true
          },
          orderBy: {
            _sum: {
              delta_points: 'desc'
            }
          },
          take: 20
        })
      })

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should query leaderboard data efficiently', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.user.findMany({
          where: {
            submissions: {
              some: {
                visibility: 'PUBLIC',
                status: 'APPROVED'
              }
            }
          },
          select: {
            id: true,
            handle: true,
            name: true,
            school: true,
            ledger: {
              select: {
                delta_points: true
              }
            }
          }
        })
      })

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should perform complex joins efficiently', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.submission.findMany({
          where: {
            status: 'APPROVED',
            user: {
              role: 'PARTICIPANT'
            }
          },
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
                school: true,
                cohort: true
              }
            },
            activity: true,
            attachments_rel: {
              select: {
                path: true,
                hash: true
              }
            }
          },
          orderBy: [
            { created_at: 'desc' },
            { user: { name: 'asc' } }
          ],
          take: 100
        })
      })

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('API Endpoint Performance', () => {
    it('should serve leaderboard API quickly', async () => {
      const request = createMockRequest('/api/leaderboard')
      
      const startTime = Date.now()
      const response = await executeApiRoute(apiHandlers.leaderboard, request)
      const duration = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LEADERBOARD)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.leaderboard).toBeDefined()
    })

    it('should serve admin submissions API quickly', async () => {
      // Mock reviewer authentication
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: testUsers[0].id,
        role: 'reviewer'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const request = createMockRequest('/api/admin/submissions', {
        searchParams: {
          status: 'PENDING',
          page: '1',
          limit: '25'
        },
        user: {
          userId: testUsers[0].id,
          role: 'REVIEWER'
        }
      })
      
      const startTime = Date.now()
      const response = await executeApiRoute(apiHandlers.adminSubmissions, request)
      const duration = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.submissions).toBeDefined()
      expect(data.data.pagination).toBeDefined()
    })

    it('should serve user dashboard API quickly', async () => {
      const request = createMockRequest('/api/dashboard', {
        user: {
          userId: testUsers[0].id,
          role: 'PARTICIPANT'
        }
      })
      
      const startTime = Date.now()
      const response = await executeApiRoute(apiHandlers.dashboard, request)
      const duration = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should handle paginated requests efficiently', async () => {
      const pageTests = [1, 2, 3, 5, 10].map(async (page) => {
        const request = createMockRequest('/api/admin/submissions', {
          searchParams: {
            page: page.toString(),
            limit: '10'
          }
        })
        
        const startTime = Date.now()
        const response = await executeApiRoute(apiHandlers.adminSubmissions, request)
        const duration = Date.now() - startTime
        
        return { page, duration, status: response.status }
      })

      const results = await Promise.all(pageTests)
      
      results.forEach(result => {
        expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
        expect(result.status).toBe(200)
      })
    })
  })

  describe('Leaderboard Performance', () => {
    it('should calculate leaderboard within performance threshold', async () => {
      const benchmark = await performanceHelper.benchmarkLeaderboard(5)
      
      expect(benchmark.avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.LEADERBOARD)
      expect(benchmark.maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.LEADERBOARD * 1.5)
      
      console.log(`Leaderboard benchmark: avg=${benchmark.avgDuration.toFixed(1)}ms, max=${benchmark.maxDuration.toFixed(1)}ms`)
    })

    it('should handle leaderboard with varying data sizes', async () => {
      const sizes = [10, 50, 100]
      
      for (const size of sizes) {
        const { duration } = await performanceHelper.measureQuery(async () => {
          return testDb.prisma.user.findMany({
            where: {
              submissions: {
                some: {
                  visibility: 'PUBLIC',
                  status: 'APPROVED'
                }
              }
            },
            select: {
              id: true,
              handle: true,
              name: true,
              school: true,
              ledger: {
                select: {
                  delta_points: true
                }
              }
            },
            take: size
          })
        })
        
        // Performance should degrade linearly, not exponentially
        const expectedThreshold = PERFORMANCE_THRESHOLDS.FAST_QUERY * (size / 10)
        expect(duration).toBeLessThan(expectedThreshold)
      }
    })

    it('should efficiently filter leaderboard by time period', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.user.findMany({
          where: {
            submissions: {
              some: {
                visibility: 'PUBLIC',
                status: 'APPROVED'
              }
            },
            ledger: {
              some: {
                created_at: {
                  gte: thirtyDaysAgo
                }
              }
            }
          },
          select: {
            id: true,
            handle: true,
            name: true,
            ledger: {
              where: {
                created_at: {
                  gte: thirtyDaysAgo
                }
              },
              select: {
                delta_points: true
              }
            }
          },
          take: 20
        })
      })
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent leaderboard requests', async () => {
      const concurrentRequests = 10
      const requests = Array(concurrentRequests).fill(null).map(() => 
        createMockRequest('/api/leaderboard')
      )
      
      const startTime = Date.now()
      const responses = await Promise.all(
        requests.map(request => executeApiRoute(apiHandlers.leaderboard, request))
      )
      const totalDuration = Date.now() - startTime
      
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_LOAD)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })

    it('should handle concurrent submission queries', async () => {
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: testUsers[0].id,
        role: 'reviewer'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const concurrentRequests = 5
      const requests = Array(concurrentRequests).fill(null).map((_, i) => 
        createMockRequest('/api/admin/submissions', {
          searchParams: {
            page: (i + 1).toString(),
            limit: '10'
          },
          user: {
            userId: testUsers[0].id,
            role: 'REVIEWER'
          }
        })
      )
      
      const startTime = Date.now()
      const responses = await Promise.all(
        requests.map(request => executeApiRoute(apiHandlers.adminSubmissions, request))
      )
      const totalDuration = Date.now() - startTime
      
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_LOAD)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })

    it('should maintain performance under mixed load', async () => {
      // Mix of different API calls
      const mixedRequests = [
        { handler: apiHandlers.leaderboard, request: createMockRequest('/api/leaderboard') },
        { handler: apiHandlers.dashboard, request: createMockRequest('/api/dashboard') },
        { handler: apiHandlers.leaderboard, request: createMockRequest('/api/leaderboard?period=30d') },
        { handler: apiHandlers.dashboard, request: createMockRequest('/api/dashboard') },
        { handler: apiHandlers.leaderboard, request: createMockRequest('/api/leaderboard') }
      ]
      
      const startTime = Date.now()
      const responses = await Promise.all(
        mixedRequests.map(({ handler, request }) => executeApiRoute(handler, request))
      )
      const totalDuration = Date.now() - startTime
      
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_LOAD)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Bulk Operation Performance', () => {
    it('should handle bulk submission approvals efficiently', async () => {
      // Create pending submissions
      const pendingSubmissions = []
      for (let i = 0; i < 25; i++) {
        const submission = await testDb.fixtures.createTestSubmission({
          user_id: testUsers[i % testUsers.length].id,
          status: 'PENDING'
        })
        pendingSubmissions.push(submission)
      }

      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: testUsers[0].id,
        role: 'reviewer'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      // Import bulk handler
      const bulkHandler = (await import('../../apps/admin/app/api/admin/submissions/route')).POST

      const request = createMockRequest('/api/admin/submissions', {
        method: 'POST',
        body: {
          submissionIds: pendingSubmissions.map(s => s.id),
          action: 'approve',
          reviewNote: 'Bulk approved for performance test'
        },
        user: {
          userId: testUsers[0].id,
          role: 'REVIEWER'
        }
      })
      
      const startTime = Date.now()
      const response = await executeApiRoute(bulkHandler, request)
      const duration = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION)

      const data = await response.json()
      expect(data.data.processed).toBe(pendingSubmissions.length)
    })

    it('should efficiently query large datasets', async () => {
      const { duration, result } = await performanceHelper.measureQuery(async () => {
        return testDb.prisma.submission.findMany({
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
                school: true
              }
            },
            activity: true,
            attachments_rel: true
          },
          orderBy: { created_at: 'desc' },
          take: 100
        })
      })
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(100)
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage()
      
      // Perform many operations
      for (let i = 0; i < 50; i++) {
        await testDb.prisma.user.findMany({
          include: {
            submissions: {
              include: {
                activity: true
              }
            },
            ledger: true
          },
          take: 10
        })
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    it('should handle database connection limits', async () => {
      // Create multiple concurrent database operations
      const operations = Array(20).fill(null).map(async (_, i) => {
        return testDb.prisma.user.findMany({
          where: {
            handle: {
              contains: 'perfuser'
            }
          },
          take: 5,
          skip: i * 5
        })
      })
      
      const startTime = Date.now()
      const results = await Promise.all(operations)
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_LOAD)
      expect(results.every(result => Array.isArray(result))).toBe(true)
    })
  })

  describe('Performance Regression Detection', () => {
    it('should maintain baseline query performance', async () => {
      const benchmarkQueries = [
        {
          name: 'Simple user query',
          query: () => testDb.prisma.user.findMany({ take: 10 }),
          threshold: PERFORMANCE_THRESHOLDS.FAST_QUERY
        },
        {
          name: 'Submission with joins',
          query: () => testDb.prisma.submission.findMany({
            include: { user: true, activity: true },
            take: 10
          }),
          threshold: PERFORMANCE_THRESHOLDS.FAST_QUERY
        },
        {
          name: 'Points aggregation',
          query: () => testDb.prisma.pointsLedger.aggregate({
            _sum: { delta_points: true },
            _count: { id: true }
          }),
          threshold: PERFORMANCE_THRESHOLDS.FAST_QUERY
        }
      ]
      
      for (const benchmark of benchmarkQueries) {
        const { duration } = await performanceHelper.measureQuery(benchmark.query)
        
        expect(duration).toBeLessThan(benchmark.threshold)
        
        // Log performance for monitoring
        console.log(`${benchmark.name}: ${duration.toFixed(1)}ms (threshold: ${benchmark.threshold}ms)`)
      }
    })

    it('should track performance trends', async () => {
      // Run the same query multiple times to check consistency
      const queryRuns = []
      
      for (let i = 0; i < 10; i++) {
        const { duration } = await performanceHelper.measureQuery(async () => {
          return testDb.prisma.user.findMany({
            include: {
              submissions: {
                where: { status: 'APPROVED' },
                include: { activity: true }
              },
              ledger: true
            },
            take: 20
          })
        })
        
        queryRuns.push(duration)
      }
      
      const avgDuration = queryRuns.reduce((a, b) => a + b, 0) / queryRuns.length
      const maxDuration = Math.max(...queryRuns)
      const minDuration = Math.min(...queryRuns)
      
      // Performance should be consistent (max shouldn't be more than 3x avg)
      expect(maxDuration).toBeLessThan(avgDuration * 3)
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE)
      
      console.log(`Query consistency: avg=${avgDuration.toFixed(1)}ms, min=${minDuration.toFixed(1)}ms, max=${maxDuration.toFixed(1)}ms`)
    })
  })
})