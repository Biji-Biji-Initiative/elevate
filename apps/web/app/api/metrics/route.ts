import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { metrics } from '@elevate/logging'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { parseActivityCode } from '@elevate/types'
import type { StageMetricsDTO } from '@elevate/types/dto-mappers'

import { buildStageMetricsDTO } from '../../../lib/metrics-helpers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const baseLogger = await getSafeServerLogger('metrics')
  const logger = baseLogger.forRequestWithHeaders
    ? baseLogger.forRequestWithHeaders(request as unknown as Request)
    : baseLogger

  try {
    // Check if this is a stage metrics request
    const stage = request.nextUrl.searchParams.get('stage')
    if (stage) {
      return getStageMetrics(stage, logger)
    }

    // Otherwise, handle internal monitoring metrics
    if (process.env.ENABLE_INTERNAL_ENDPOINTS !== '1') {
      return new Response(null, { status: 404 })
    }
    // Check for authorization - only internal monitoring should access this
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${
      process.env.INTERNAL_METRICS_TOKEN || 'dev-token'
    }`

    if (authHeader !== expectedAuth) {
      logger.warn('Unauthorized metrics access attempt', {
        operation: 'metrics_access',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      })

      return createErrorResponse(new Error('Unauthorized'), 401)
    }

    const format = request.nextUrl.searchParams.get('format') || 'json'

    if (format === 'prometheus') {
      // Return Prometheus metrics format
      const prometheusMetrics = metrics.getPrometheusMetrics()

      logger.info('Metrics accessed in Prometheus format', {
        operation: 'metrics_prometheus_access',
      })

      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    // Default JSON format
    const metricsSummary = metrics.getMetricsSummary()

    logger.info('Metrics accessed in JSON format', {
      operation: 'metrics_json_access',
    })

    const res = createSuccessResponse(metricsSummary)
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return res
  } catch (error) {
    logger.error(
      'Failed to retrieve metrics',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'metrics_access_error',
      },
    )

    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}

async function getStageMetrics(stage: string, logger: any) {
  try {
    // Validate stage
    const activityCode = parseActivityCode(stage.toUpperCase())
    if (!activityCode) {
      return createErrorResponse(new Error('Invalid stage'), 400)
    }

    // Get submissions for this stage
    const [
      totalSubmissions,
      approvedSubmissions,
      pendingSubmissions,
      rejectedSubmissions,
      uniqueEducators,
      pointsLedger,
    ] = await Promise.all([
      prisma.submission.count({
        where: { activity_code: activityCode },
      }),
      prisma.submission.count({
        where: { activity_code: activityCode, status: 'APPROVED' },
      }),
      prisma.submission.count({
        where: { activity_code: activityCode, status: 'PENDING' },
      }),
      prisma.submission.count({
        where: { activity_code: activityCode, status: 'REJECTED' },
      }),
      prisma.submission.groupBy({
        by: ['user_id'],
        where: { activity_code: activityCode },
        _count: { id: true },
      }),
      // Points are tracked in the points_ledger table; select deltas and map to DTO shape
      prisma.pointsLedger.findMany({
        where: { activity_code: activityCode },
        select: { delta_points: true },
      }),
    ])

    // Calculate average points
    // Get top schools
    const topSchoolsData = await prisma.user.groupBy({
      by: ['school'],
      where: {
        submissions: {
          some: { activity_code: activityCode },
        },
        school: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const topSchools = topSchoolsData.map((s) => ({
      name: s.school || 'Unknown',
      count: s._count.id,
    }))

    // Get cohort breakdown
    const cohortData = await prisma.user.groupBy({
      by: ['cohort'],
      where: {
        submissions: {
          some: { activity_code: activityCode },
        },
        cohort: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    const cohortBreakdown = cohortData.map((c) => ({
      cohort: c.cohort || 'Unknown',
      count: c._count.id,
    }))

    // Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyData = await prisma.submission.findMany({
      where: {
        activity_code: activityCode,
        created_at: { gte: sixMonthsAgo },
      },
      select: {
        created_at: true,
        status: true,
      },
    })

    // Group by month
    const monthlyMap: Record<
      string,
      { submissions: number; approvals: number }
    > = {}
    monthlyData.forEach((submission) => {
      const monthKey = submission.created_at.toISOString().slice(0, 7) // YYYY-MM format
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { submissions: 0, approvals: 0 }
      }
      monthlyMap[monthKey].submissions++
      if (submission.status === 'APPROVED') {
        monthlyMap[monthKey].approvals++
      }
    })

    const monthlyTrend = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      submissions: data.submissions,
      approvals: data.approvals,
    }))

    const dto: StageMetricsDTO = buildStageMetricsDTO({
      stage: activityCode,
      totalSubmissions,
      approvedSubmissions,
      pendingSubmissions,
      rejectedSubmissions,
      uniqueEducators: uniqueEducators.length,
      // Map ledger deltas to expected shape
      points: pointsLedger.map((p) => ({ points_awarded: p.delta_points })),
      topSchools,
      cohortBreakdown,
      monthly: monthlyTrend,
    })

    logger.info('Stage metrics retrieved', {
      operation: 'stage_metrics_access',
      stage: activityCode,
    })

    const res = createSuccessResponse(dto)
    res.headers.set('Cache-Control', 'public, s-maxage=300')
    return res
  } catch (error) {
    logger.error(
      'Failed to retrieve stage metrics',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'stage_metrics_error',
        stage,
      },
    )

    return createErrorResponse(new Error('Internal Server Error'), 500)
  }
}
