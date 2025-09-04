import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'

import { withRole } from '@elevate/auth'
import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { getServerLogger } from '@elevate/logging'

export const runtime = 'nodejs'
export const maxDuration = 60

type TestResult = {
  test_name: string
  status: 'PASSED' | 'FAILED' | 'WARNING'
  message: string
  expected?: number | string
  actual?: number | string
  duration_ms: number
  details?: Record<string, unknown>
}

type TestSuite = {
  suite_name: string
  total_tests: number
  passed_tests: number
  failed_tests: number
  warning_tests: number
  duration_ms: number
  results: TestResult[]
}

async function testDataConsistency(): Promise<TestSuite> {
  const startTime = Date.now()
  const results: TestResult[] = []

  // Test 1: Leaderboard totals vs live calculation
  const test1Start = Date.now()
  try {
    const materializedTotal = await prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(*) as count FROM leaderboard_totals WHERE total_points > 0
    `
    
    const liveTotal = await prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(DISTINCT pl.user_id) as count 
      FROM points_ledger pl
      JOIN users u ON pl.user_id = u.id
      WHERE u.role = 'PARTICIPANT' AND pl.delta_points > 0
    `

    const matCount = Number(materializedTotal[0]?.count ?? 0)
    const liveCount = Number(liveTotal[0]?.count ?? 0)
    const difference = Math.abs(matCount - liveCount)
    
    results.push({
      test_name: 'leaderboard_totals_user_count_consistency',
      status: difference <= 1 ? 'PASSED' : (difference <= 5 ? 'WARNING' : 'FAILED'),
      message: difference <= 1 ? 'User counts match between materialized view and live calculation' 
        : `User count difference: ${difference} users`,
      expected: liveCount,
      actual: matCount,
      duration_ms: Date.now() - test1Start
    })
  } catch (error) {
    results.push({
      test_name: 'leaderboard_totals_user_count_consistency',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test1Start
    })
  }

  // Test 2: Points calculation accuracy
  const test2Start = Date.now()
  try {
    // Sample a few users and verify their points
    const sampleUsers = await prisma.$queryRaw<{user_id: string, mv_points: number}[]>`
      SELECT user_id, total_points as mv_points 
      FROM leaderboard_totals 
      ORDER BY total_points DESC 
      LIMIT 5
    `

    let pointsAccuracyPassed = 0
    let pointsAccuracyFailed = 0

    for (const user of sampleUsers) {
      const livePoints = await prisma.$queryRaw<{total_points: number}[]>`
        SELECT COALESCE(SUM(delta_points), 0) as total_points
        FROM points_ledger 
        WHERE user_id = ${user.user_id}
      `
      
      const liveTotal = Number(livePoints[0]?.total_points ?? 0)
      const mvTotal = Number(user.mv_points)
      
      if (Math.abs(liveTotal - mvTotal) <= 1) {
        pointsAccuracyPassed++
      } else {
        pointsAccuracyFailed++
      }
    }

    results.push({
      test_name: 'points_calculation_accuracy',
      status: pointsAccuracyFailed === 0 ? 'PASSED' : (pointsAccuracyPassed > pointsAccuracyFailed ? 'WARNING' : 'FAILED'),
      message: `Points accuracy: ${pointsAccuracyPassed}/${sampleUsers.length} users have accurate points`,
      duration_ms: Date.now() - test2Start,
      details: { passed: pointsAccuracyPassed, failed: pointsAccuracyFailed, total: sampleUsers.length }
    })
  } catch (error) {
    results.push({
      test_name: 'points_calculation_accuracy',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test2Start
    })
  }

  // Test 3: 30-day period accuracy
  const test3Start = Date.now()
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const mv30dCount = await prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(*) as count FROM leaderboard_30d WHERE total_points > 0
    `

    const live30dCount = await prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(DISTINCT pl.user_id) as count
      FROM points_ledger pl
      JOIN users u ON pl.user_id = u.id
      WHERE u.role = 'PARTICIPANT' 
        AND pl.created_at >= ${thirtyDaysAgo}
        AND pl.delta_points > 0
    `

    const mv30d = Number(mv30dCount[0]?.count ?? 0)
    const live30d = Number(live30dCount[0]?.count ?? 0)
    const diff30d = Math.abs(mv30d - live30d)

    results.push({
      test_name: 'leaderboard_30d_period_accuracy',
      status: diff30d <= 2 ? 'PASSED' : (diff30d <= 10 ? 'WARNING' : 'FAILED'),
      message: diff30d <= 2 ? '30-day leaderboard period calculation is accurate'
        : `30-day period difference: ${diff30d} users`,
      expected: live30d,
      actual: mv30d,
      duration_ms: Date.now() - test3Start
    })
  } catch (error) {
    results.push({
      test_name: 'leaderboard_30d_period_accuracy',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test3Start
    })
  }

  // Test 4: Activity metrics consistency
  const test4Start = Date.now()
  try {
    const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
    let metricsAccurate = 0
    let metricsInaccurate = 0

    for (const activity of activities) {
      const mvMetrics = await prisma.$queryRaw<{
        total_submissions: number
        approved_submissions: number
      }[]>`
        SELECT total_submissions, approved_submissions
        FROM activity_metrics 
        WHERE code = ${activity}
      `

      const liveMetrics = await prisma.$queryRaw<{
        total_submissions: number
        approved_submissions: number
      }[]>`
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_submissions
        FROM submissions 
        WHERE activity_code = ${activity}
      `

      const mvTotal = Number(mvMetrics[0]?.total_submissions ?? 0)
      const mvApproved = Number(mvMetrics[0]?.approved_submissions ?? 0)
      const liveTotal = Number(liveMetrics[0]?.total_submissions ?? 0)
      const liveApproved = Number(liveMetrics[0]?.approved_submissions ?? 0)

      if (mvTotal === liveTotal && mvApproved === liveApproved) {
        metricsAccurate++
      } else {
        metricsInaccurate++
      }
    }

    results.push({
      test_name: 'activity_metrics_consistency',
      status: metricsInaccurate === 0 ? 'PASSED' : (metricsAccurate >= metricsInaccurate ? 'WARNING' : 'FAILED'),
      message: `Activity metrics: ${metricsAccurate}/${activities.length} activities have consistent metrics`,
      duration_ms: Date.now() - test4Start,
      details: { accurate: metricsAccurate, inaccurate: metricsInaccurate, total: activities.length }
    })
  } catch (error) {
    results.push({
      test_name: 'activity_metrics_consistency',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test4Start
    })
  }

  // Test 5: No orphaned records in materialized views
  const test5Start = Date.now()
  try {
    const orphanedUsers = await prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(*) as count
      FROM leaderboard_totals lt
      LEFT JOIN users u ON lt.user_id = u.id
      WHERE u.id IS NULL
    `

    const orphanCount = Number(orphanedUsers[0]?.count ?? 0)

    results.push({
      test_name: 'no_orphaned_records',
      status: orphanCount === 0 ? 'PASSED' : 'FAILED',
      message: orphanCount === 0 ? 'No orphaned records in materialized views'
        : `Found ${orphanCount} orphaned user records`,
      actual: orphanCount,
      expected: 0,
      duration_ms: Date.now() - test5Start
    })
  } catch (error) {
    results.push({
      test_name: 'no_orphaned_records',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test5Start
    })
  }

  const totalDuration = Date.now() - startTime
  const passed = results.filter(r => r.status === 'PASSED').length
  const failed = results.filter(r => r.status === 'FAILED').length
  const warnings = results.filter(r => r.status === 'WARNING').length

  return {
    suite_name: 'Data Consistency Tests',
    total_tests: results.length,
    passed_tests: passed,
    failed_tests: failed,
    warning_tests: warnings,
    duration_ms: totalDuration,
    results
  }
}

async function testPerformanceBenchmarks(): Promise<TestSuite> {
  const startTime = Date.now()
  const results: TestResult[] = []

  // Performance thresholds (ms)
  const FAST_QUERY_THRESHOLD = 100
  const ACCEPTABLE_QUERY_THRESHOLD = 500

  // Test 1: Leaderboard top 50 performance
  const test1Start = Date.now()
  try {
    await prisma.$queryRaw`
      SELECT user_id, handle, name, total_points 
      FROM leaderboard_totals 
      ORDER BY total_points DESC 
      LIMIT 50
    `
    
    const duration = Date.now() - test1Start
    results.push({
      test_name: 'leaderboard_top_50_performance',
      status: duration < FAST_QUERY_THRESHOLD ? 'PASSED' 
        : duration < ACCEPTABLE_QUERY_THRESHOLD ? 'WARNING' : 'FAILED',
      message: `Top 50 leaderboard query took ${duration}ms`,
      actual: duration,
      expected: FAST_QUERY_THRESHOLD,
      duration_ms: duration
    })
  } catch (error) {
    results.push({
      test_name: 'leaderboard_top_50_performance',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test1Start
    })
  }

  // Test 2: Search query performance
  const test2Start = Date.now()
  try {
    await prisma.$queryRaw`
      SELECT user_id, handle, name, total_points 
      FROM leaderboard_totals 
      WHERE name ILIKE '%john%' OR handle ILIKE '%john%'
      ORDER BY total_points DESC 
      LIMIT 20
    `
    
    const duration = Date.now() - test2Start
    results.push({
      test_name: 'leaderboard_search_performance',
      status: duration < ACCEPTABLE_QUERY_THRESHOLD ? 'PASSED' : 'WARNING',
      message: `Search query took ${duration}ms`,
      actual: duration,
      expected: ACCEPTABLE_QUERY_THRESHOLD,
      duration_ms: duration
    })
  } catch (error) {
    results.push({
      test_name: 'leaderboard_search_performance',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test2Start
    })
  }

  // Test 3: Activity metrics query performance
  const test3Start = Date.now()
  try {
    await prisma.$queryRaw`SELECT * FROM activity_metrics ORDER BY total_submissions DESC`
    
    const duration = Date.now() - test3Start
    results.push({
      test_name: 'activity_metrics_performance',
      status: duration < FAST_QUERY_THRESHOLD ? 'PASSED' 
        : duration < ACCEPTABLE_QUERY_THRESHOLD ? 'WARNING' : 'FAILED',
      message: `Activity metrics query took ${duration}ms`,
      actual: duration,
      expected: FAST_QUERY_THRESHOLD,
      duration_ms: duration
    })
  } catch (error) {
    results.push({
      test_name: 'activity_metrics_performance',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test3Start
    })
  }

  const totalDuration = Date.now() - startTime
  const passed = results.filter(r => r.status === 'PASSED').length
  const failed = results.filter(r => r.status === 'FAILED').length
  const warnings = results.filter(r => r.status === 'WARNING').length

  return {
    suite_name: 'Performance Benchmark Tests',
    total_tests: results.length,
    passed_tests: passed,
    failed_tests: failed,
    warning_tests: warnings,
    duration_ms: totalDuration,
    results
  }
}

async function testRefreshFunctionality(): Promise<TestSuite> {
  const startTime = Date.now()
  const results: TestResult[] = []

  // Test 1: Refresh function exists and is callable
  const test1Start = Date.now()
  try {
    await prisma.$queryRaw`SELECT refresh_leaderboards()`
    
    results.push({
      test_name: 'refresh_function_callable',
      status: 'PASSED',
      message: 'Refresh function executed successfully',
      duration_ms: Date.now() - test1Start
    })
  } catch (error) {
    results.push({
      test_name: 'refresh_function_callable',
      status: 'FAILED',
      message: `Refresh function failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test1Start
    })
  }

  // Test 2: All materialized views exist
  const test2Start = Date.now()
  try {
    const views = await prisma.$queryRaw<{matviewname: string}[]>`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE matviewname IN ('leaderboard_totals', 'leaderboard_30d', 'activity_metrics')
      ORDER BY matviewname
    `

    const expectedViews = ['activity_metrics', 'leaderboard_30d', 'leaderboard_totals']
    const actualViews = views.map(v => v.matviewname).sort()
    const allViewsExist = expectedViews.every(view => actualViews.includes(view))

    results.push({
      test_name: 'materialized_views_exist',
      status: allViewsExist ? 'PASSED' : 'FAILED',
      message: allViewsExist ? 'All expected materialized views exist'
        : `Missing views: ${expectedViews.filter(v => !actualViews.includes(v)).join(', ')}`,
      expected: expectedViews.join(', '),
      actual: actualViews.join(', '),
      duration_ms: Date.now() - test2Start
    })
  } catch (error) {
    results.push({
      test_name: 'materialized_views_exist',
      status: 'FAILED',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration_ms: Date.now() - test2Start
    })
  }

  const totalDuration = Date.now() - startTime
  const passed = results.filter(r => r.status === 'PASSED').length
  const failed = results.filter(r => r.status === 'FAILED').length
  const warnings = results.filter(r => r.status === 'WARNING').length

  return {
    suite_name: 'Refresh Functionality Tests',
    total_tests: results.length,
    passed_tests: passed,
    failed_tests: failed,
    warning_tests: warnings,
    duration_ms: totalDuration,
    results
  }
}

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
    return new Response(null, { status: 404 })
  }
  try {
    // Verify admin role
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse(new Error('Unauthorized'), 401)
    }

    const hasPermission = await withRole(['ADMIN'])(userId)
    if (!hasPermission) {
      return createErrorResponse(new Error('Insufficient permissions'), 403)
    }

    const { searchParams } = new URL(request.url)
    const suiteParam = searchParams.get('suite')
    const suitesToRun = suiteParam ? [suiteParam] : ['consistency', 'performance', 'refresh']

    getServerLogger().info('Running materialized view tests', {
      operation: 'admin_test_materialized_views',
      suites: suitesToRun,
    })

    const testStartTime = Date.now()
    const testSuites: TestSuite[] = []

    // Run requested test suites
    if (suitesToRun.includes('consistency')) {
      testSuites.push(await testDataConsistency())
    }

    if (suitesToRun.includes('performance')) {
      testSuites.push(await testPerformanceBenchmarks())
    }

    if (suitesToRun.includes('refresh')) {
      testSuites.push(await testRefreshFunctionality())
    }

    const totalTestDuration = Date.now() - testStartTime

    // Calculate overall statistics
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.total_tests, 0)
    const totalPassed = testSuites.reduce((sum, suite) => sum + suite.passed_tests, 0)
    const totalFailed = testSuites.reduce((sum, suite) => sum + suite.failed_tests, 0)
    const totalWarnings = testSuites.reduce((sum, suite) => sum + suite.warning_tests, 0)
    const overallStatus = totalFailed === 0 ? (totalWarnings === 0 ? 'PASSED' : 'WARNING') : 'FAILED'

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      summary: {
        total_test_suites: testSuites.length,
        total_tests: totalTests,
        total_passed: totalPassed,
        total_failed: totalFailed,
        total_warnings: totalWarnings,
        success_rate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0,
        total_duration_ms: totalTestDuration
      },
      test_suites: testSuites
    }

    const res = createSuccessResponse(response)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res

  } catch (error) {
    getServerLogger().error('Materialized view testing failed', error as Error, {
      operation: 'admin_test_materialized_views',
    })
    return createErrorResponse(new Error('Failed to run tests'), 500)
  }
}
