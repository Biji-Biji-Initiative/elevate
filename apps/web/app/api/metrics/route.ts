import type { NextRequest } from 'next/server'

import { Prisma } from '@prisma/client'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'

import { buildStageMetricsDTO } from '../../../lib/metrics-helpers'

export const runtime = 'nodejs'

const validStages = ['learn', 'explore', 'amplify', 'present', 'shine'] as const
type ValidStage = (typeof validStages)[number]

function isValidStage(stage: string): stage is ValidStage {
  return validStages.includes(stage as ValidStage)
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, publicApiRateLimiter, async () => {
    const logger = await getSafeServerLogger('metrics')
    try {
      const stageRaw = (
        request.nextUrl.searchParams.get('stage') || ''
      ).toLowerCase()

      if (!isValidStage(stageRaw)) {
        return createErrorResponse(new Error('Invalid or missing stage'), 400)
      }

      // Map to uppercase activity code used in DB
      const activityCode = stageRaw.toUpperCase() as
        | 'LEARN'
        | 'EXPLORE'
        | 'AMPLIFY'
        | 'PRESENT'
        | 'SHINE'

      // Parallelize core aggregations
      const [
        totalSubmissions,
        approvedSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        uniqueEducatorGroups,
        points,
        topSchoolsRaw,
        cohortRaw,
        monthlyRaw,
      ] = await Promise.all([
        prisma.submission.count({ where: { activity_code: activityCode } }),
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
        // Points awarded per approved submission - derive from points_ledger
        prisma.$queryRaw<Array<{ delta_points: number }>>(Prisma.sql`
        SELECT pl.delta_points
        FROM points_ledger pl
        WHERE pl.activity_code = ${activityCode}
          AND (
            pl.source = 'FORM' OR pl.source = 'WEBHOOK' OR pl.source = 'MANUAL'
          )
      `),
        // Top schools that have at least one submission in this stage
        prisma.user.groupBy({
          by: ['school'],
          where: {
            submissions: { some: { activity_code: activityCode } },
          },
          _count: { id: true },
        }),
        // Cohort breakdown of participants in this stage
        prisma.user.groupBy({
          by: ['cohort'],
          where: {
            submissions: { some: { activity_code: activityCode } },
          },
          _count: { id: true },
        }),
        // Monthly trend for this stage (YYYY-MM labels)
        prisma.$queryRaw<
          Array<{ month: string; submissions: number; approvals: number }>
        >(
          Prisma.sql`
          SELECT
            TO_CHAR(created_at, 'YYYY-MM') AS month,
            COUNT(*)::int AS submissions,
            COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approvals
          FROM submissions
          WHERE activity_code = ${activityCode}
          GROUP BY 1
          ORDER BY 1
        `,
        ),
      ])

      // Normalize points to expected shape for DTO builder
      const pointsNormalized = points.map((p) => ({
        points_awarded: p.delta_points ?? 0,
      }))

      const raw = {
        stage: activityCode,
        totalSubmissions,
        approvedSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        uniqueEducators: uniqueEducatorGroups.length,
        points: pointsNormalized,
        topSchools: topSchoolsRaw
          .filter((r) => r.school)
          .map((r) => ({ name: String(r.school), count: r._count.id })),
        cohortBreakdown: cohortRaw
          .filter((r) => r.cohort)
          .map((r) => ({ cohort: String(r.cohort), count: r._count.id })),
        monthly: monthlyRaw,
      }

      const dto = buildStageMetricsDTO(raw)

      const res = createSuccessResponse(dto)
      res.headers.set(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=600',
      )
      return res
    } catch (error) {
      logger.error(
        'Failed to compute stage metrics',
        error instanceof Error ? error : new Error(String(error)),
        { operation: 'stage_metrics' },
      )
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
