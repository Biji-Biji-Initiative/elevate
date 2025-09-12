import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import {
  AssignBadgeSchema,
  RemoveBadgeSchema,
  buildAuditMeta,
} from '@elevate/types'

export const runtime = 'nodejs'

export const POST = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  const baseLogger = await getSafeServerLogger('admin-badges-assign')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      const logger = createRequestLogger(baseLogger, request)
      const user = await requireRole('admin')
      const body: unknown = await request.json()
      const parsed = AssignBadgeSchema.safeParse(body)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
      }
      const { badgeCode, userIds, reason } = parsed.data

      if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'badgeCode and userIds array are required'))
      }

      // Limit bulk operations
      if (userIds.length > 100) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk badge assignment'))
      }

      // Verify badge exists
      const badge = await prisma.badge.findUnique({
        where: { code: badgeCode },
      })

      if (!badge) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'Badge not found'))
      }

      // Verify users exist
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          name: true,
          handle: true,
        },
      })

      if (users.length === 0) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'No valid users found'))
      }

      // Check for existing badge assignments
      const existingAssignments = await prisma.earnedBadge.findMany({
        where: {
          badge_code: badgeCode,
          user_id: { in: userIds },
        },
      })

      const existingUserIds = new Set(
        existingAssignments.map((eb) => eb.user_id),
      )
      const newUserIds = userIds.filter(
        (id) => !existingUserIds.has(id) && users.some((u) => u.id === id),
      )

      if (newUserIds.length === 0) {
        return toErrorResponse(new AdminError('CONFLICT', 'All specified users already have this badge'))
      }

      const results = await prisma.$transaction(async (tx) => {
        const assignments = []

        for (const userId of newUserIds) {
          const assignment = await tx.earnedBadge.create({
            data: {
              user_id: userId,
              badge_code: badgeCode,
              earned_at: new Date(),
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  handle: true,
                },
              },
              badge: true,
            },
          })

          // Create audit log
          await tx.auditLog.create({
            data: {
              actor_id: user.userId,
              action: 'ASSIGN_BADGE',
              target_id: userId,
              meta: buildAuditMeta(
                { entityType: 'badge', entityId: badgeCode },
                {
                  badgeCode,
                  badgeName: badge.name,
                  reason,
                  manualAssignment: true,
                },
              ) as Prisma.InputJsonValue,
            },
          })

          assignments.push(assignment)
        }

        return assignments
      })

      logger.info('Assigned badge to users', {
        badgeCode,
        processed: results.length,
        requested: userIds.length,
      })
      {
        const res = toSuccessResponse({
          message: `Badge "${badge.name}" assigned to ${results.length} users`,
          processed: results.length,
          failed: userIds.length - results.length,
        })
        return res
      }
    } catch (error) {
      {
        const logger = createRequestLogger(baseLogger, request)
        logger.error(
          'Assign badge failed',
          error instanceof Error ? error : new Error(String(error)),
        )
        const errRes = toErrorResponse(error)
        return errRes
      }
    }
  })
})

// Remove badge from users
export const DELETE = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  const baseLogger = await getSafeServerLogger('admin-badges-assign')
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      const logger = createRequestLogger(baseLogger, request)
      const user = await requireRole('admin')
      const body: unknown = await request.json()
      const parsed = RemoveBadgeSchema.safeParse(body)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
      }
      const { badgeCode, userIds, reason } = parsed.data

      if (!badgeCode || !Array.isArray(userIds) || userIds.length === 0) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'badgeCode and userIds array are required'))
      }

      // Limit bulk operations
      if (userIds.length > 100) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Maximum 100 users per bulk badge removal'))
      }

      // Find existing assignments
      const assignments = await prisma.earnedBadge.findMany({
        where: {
          badge_code: badgeCode,
          user_id: { in: userIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
            },
          },
          badge: true,
        },
      })

      if (assignments.length === 0) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'No badge assignments found for specified users'))
      }

      await prisma.$transaction(async (tx) => {
        for (const assignment of assignments) {
          await tx.earnedBadge.delete({
            where: {
              id: assignment.id,
            },
          })

          // Create audit log
          await tx.auditLog.create({
            data: {
              actor_id: user.userId,
              action: 'REMOVE_BADGE',
              target_id: assignment.user_id,
              meta: buildAuditMeta(
                { entityType: 'badge', entityId: badgeCode },
                {
                  badgeCode,
                  badgeName: assignment.badge.name,
                  reason,
                  earnedAt: assignment.earned_at,
                },
              ) as Prisma.InputJsonValue,
            },
          })
        }
      })

      // We already checked assignments.length === 0 above, but TypeScript needs this check
      const badgeName = assignments[0]?.badge.name ?? 'Unknown Badge'

      logger.info('Removed badge from users', {
        badgeCode,
        processed: assignments.length,
        requested: userIds.length,
      })
      {
        const res = toSuccessResponse({
          message: `Badge "${badgeName}" removed from ${assignments.length} users`,
          processed: assignments.length,
          failed: 0,
        })
        return res
      }
    } catch (error) {
      {
        const logger = createRequestLogger(baseLogger, request)
        logger.error(
          'Remove badge failed',
          error instanceof Error ? error : new Error(String(error)),
        )
        const errRes = toErrorResponse(error)
        return errRes
      }
    }
  })
})
