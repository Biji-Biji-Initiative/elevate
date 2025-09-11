import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

import { auth, clerkClient } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import {
  createSuccessResponse,
  withApiErrorHandling,
  type ApiContext,
} from '@elevate/http'
import { enrollUserInKajabi } from '@elevate/integrations'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import { AuthenticationError } from '@elevate/types/errors'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(
  async (_request: NextRequest, _context: ApiContext) => {
    const start = Date.now()
    const { userId } = await auth()

    if (!userId) {
      throw new AuthenticationError()
    }

    // Get user information (create on first login if missing)
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        handle: true,
        school: true,
        cohort: true,
        user_type: true,
        user_type_confirmed: true,
        kajabi_contact_id: true,
      },
    })

    if (!user) {
      // Fetch from Clerk and create a minimal user profile
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        `${userId}@example.dev`
      const baseHandle =
        (
          clerkUser.username ||
          clerkUser.firstName ||
          email.split('@')[0] ||
          'user'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || `user${userId.slice(-6)}`
      const handle =
        baseHandle.length >= 3 ? baseHandle : `user${userId.slice(-6)}`

      user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          name:
            `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
            'Participant',
          email,
          handle,
          role: 'PARTICIPANT',
          // Default to STUDENT until onboarding confirms role
          user_type: 'STUDENT',
          user_type_confirmed: false,
        },
        select: {
          id: true,
          name: true,
          handle: true,
          school: true,
          cohort: true,
          user_type: true,
          user_type_confirmed: true,
          kajabi_contact_id: true,
        },
      })

      // Enrollment is educators-only after onboarding, handled there; no-op here
    }

    // If educator is confirmed and not yet enrolled, best-effort enrollment here as a fallback
    try {
      if (
        user &&
        user.user_type === 'EDUCATOR' &&
        user.user_type_confirmed &&
        !user.kajabi_contact_id
      ) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } })
        const emailToUse = dbUser?.email || ''
        const nameToUse = dbUser?.name || emailToUse.split('@')[0] || 'Educator'
        const offerId = process.env.KAJABI_OFFER_ID
        const result = await enrollUserInKajabi(emailToUse, nameToUse, {
          ...(offerId ? { offerId } : {}),
        })
        if (result.success && result.contactId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { kajabi_contact_id: String(result.contactId) },
          })
        }
      }
    } catch {
      // ignore; webhook + admin tools remain primary path
    }

    // Referral attribution and signup bonus (idempotent)
    try {
      const c = await cookies()
      const refCookie = c.get?.('ref')?.value
      if (refCookie && user) {
        // Require explicit user_type confirmation before awarding referral points
        const confirmRows = await prisma.$queryRaw<
          { user_type_confirmed: boolean }[]
        >`
          SELECT user_type_confirmed FROM users WHERE id = ${user.id}::text
        `
        const confirmed =
          Array.isArray(confirmRows) && !!confirmRows[0]?.user_type_confirmed
        if (!confirmed) {
          // Skip awarding until user picks their role
          throw new Error('USER_TYPE_NOT_CONFIRMED')
        }
        // Resolve referrer by handle, email, or ref_code
        // Use raw SQL to support optional columns not present in Prisma types (e.g., ref_code)
        const refRows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM users
          WHERE handle = ${refCookie} OR email = ${refCookie} OR ref_code = ${refCookie}
          LIMIT 1
        `
        const referrer =
          Array.isArray(refRows) && refRows[0] ? { id: refRows[0].id } : null
        if (referrer && referrer.id !== user.id) {
          // If not already referred, set and award
          // Read via raw query (column added via migration; may not be in Prisma types yet)
          const currentRef = await prisma.$queryRaw<
            { referred_by_user_id: string | null }[]
          >`
            SELECT referred_by_user_id FROM users WHERE id = ${user.id}::text
          `
          const alreadyReferred =
            Array.isArray(currentRef) && currentRef[0]?.referred_by_user_id
          if (!alreadyReferred) {
          // Set referred_by_user_id
          await prisma.$executeRaw`
            UPDATE users SET referred_by_user_id = ${referrer.id}
            WHERE id = ${user.id} AND referred_by_user_id IS NULL
          `
          // Award referrer points (referrer must be EDUCATOR) with monthly cap 50
          const [referee, referrerUser] = await Promise.all([
            prisma.user.findUnique({ where: { id: user.id }, select: { user_type: true } }),
            prisma.user.findUnique({ where: { id: referrer.id }, select: { user_type: true } }),
          ])
          // Only educators can earn referral points
          const isReferrerEducator = referrerUser?.user_type === 'EDUCATOR'
          // Points by referee type: +2 for educator, +1 for student
          const baseDelta = referee?.user_type === 'EDUCATOR' ? 2 : 1
          const delta = isReferrerEducator ? baseDelta : 0
          const externalId = `referral:signup:${user.id}`
          const existing = await prisma.pointsLedger.findFirst({
            where: { external_event_id: externalId },
          })
          if (!existing) {
            const now = new Date()
            const monthStart = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
            )
            const awardedThisMonthAgg = await prisma.pointsLedger.aggregate({
              _sum: { delta_points: true },
              where: {
                user_id: referrer.id,
                external_source: 'referral',
                event_time: { gte: monthStart },
              },
            })
            const awardedThisMonth =
              awardedThisMonthAgg._sum.delta_points || 0
            const remaining = Math.max(0, 50 - awardedThisMonth)
            const grant = Math.min(remaining, delta)
            if (grant > 0) {
              await prisma.pointsLedger.create({
                data: {
                  user_id: referrer.id,
                  activity_code: 'AMPLIFY',
                  source: 'FORM',
                  delta_points: grant,
                  external_source: 'referral',
                  external_event_id: externalId,
                  event_time: new Date(),
                  meta: { referee_id: user.id },
                },
              })
            }
            // Record referral event using raw SQL for compatibility (table may be optional)
            try {
              await prisma.$executeRaw`
                INSERT INTO referral_events (referrer_user_id, referee_user_id, event_type, external_event_id, source)
                VALUES (${referrer.id}, ${
                user.id
              }, ${'signup'}, ${externalId}, ${'cookie'})
                ON CONFLICT DO NOTHING
              `
            } catch {
              // ignore unique conflict
            }
          }
          }
        }
      }
    } catch {
      // best-effort; do not block dashboard
    }

    // Get all user data in parallel for better performance
    const [
      pointsResult,
      submissions,
      earnedBadges,
      pointsByActivityRaw,
      learnGrantsCount,
    ] = await Promise.all([
      // Get user's total points
      prisma.pointsLedger.aggregate({
        where: { user_id: userId },
        _sum: { delta_points: true },
      }),

      // Get user's submissions with activity details
      prisma.submission.findMany({
        where: { user_id: userId },
        include: {
          activity: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      }),

      // Get user's earned badges
      prisma.earnedBadge.findMany({
        where: { user_id: userId },
        include: {
          badge: true,
        },
        orderBy: {
          earned_at: 'desc',
        },
      }),
      // Sum points per activity from points_ledger (Option B)
      prisma.pointsLedger.groupBy({
        by: ['activity_code'],
        where: { user_id: userId },
        _sum: { delta_points: true },
      }),
      // Learn completion proxy: check tag grants for user
      prisma.learnTagGrant.count({ where: { user_id: userId } }),
    ])

    const totalPoints = pointsResult._sum.delta_points || 0

    const pointsByActivity = pointsByActivityRaw.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.activity_code] = Math.max(0, row._sum.delta_points || 0)
        return acc
      },
      {},
    )

    // Group submissions by activity
    const submissionsByActivity = submissions.reduce<
      Record<string, typeof submissions>
    >((acc, submission) => {
      const activityCode = submission.activity_code
      if (!acc[activityCode]) {
        acc[activityCode] = []
      }
      acc[activityCode].push(submission)
      return acc
    }, {})

    // Calculate progress for each LEAPS stage
    const activities = await prisma.activity.findMany({
      orderBy: { code: 'asc' },
    })

    const progress = activities.map((activity) => {
      const activitySubmissions = submissionsByActivity[activity.code] || []
      const approvedSubmissions = activitySubmissions.filter(
        (s) => s.status === 'APPROVED',
      )
      const pendingSubmissions = activitySubmissions.filter(
        (s) => s.status === 'PENDING',
      )
      const rejectedSubmissions = activitySubmissions.filter(
        (s) => s.status === 'REJECTED',
      )

      // Calculate points earned from this activity via ledger (Option B)
      const activityPoints = pointsByActivity[activity.code] || 0

      return {
        activityCode: activity.code,
        activityName: activity.name,
        defaultPoints: activity.default_points,
        pointsEarned: activityPoints,
        submissionCounts: {
          total: activitySubmissions.length,
          approved: approvedSubmissions.length,
          pending: pendingSubmissions.length,
          rejected: rejectedSubmissions.length,
        },
        latestSubmission: activitySubmissions[0] || null,
        // Treat LEARN completion as presence of any Learn tag grants; others by approved submissions
        hasCompleted:
          activity.code === 'LEARN'
            ? learnGrantsCount > 0
            : approvedSubmissions.length > 0,
      }
    })

    // Recent activity (last 5 submissions)
    const recentActivity = submissions.slice(0, 5).map((submission) => ({
      id: submission.id,
      activityCode: submission.activity_code,
      activityName: submission.activity.name,
      status: submission.status,
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
    }))

    const res = createSuccessResponse({
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        school: user.school,
        cohort: user.cohort,
      },
      points: {
        total: totalPoints,
        breakdown: progress.reduce<Record<string, number>>((acc, p) => {
          acc[p.activityCode] = p.pointsEarned
          return acc
        }, {}),
      },
      progress,
      badges: earnedBadges.map((eb) => ({
        code: eb.badge_code,
        name: eb.badge.name,
        description: eb.badge.description,
        iconUrl: eb.badge.icon_url,
        earnedAt: eb.earned_at,
      })),
      recentActivity,
      stats: {
        totalSubmissions: submissions.length,
        approvedSubmissions: submissions.filter((s) => s.status === 'APPROVED')
          .length,
        pendingSubmissions: submissions.filter((s) => s.status === 'PENDING')
          .length,
        completedStages: progress.filter((p) => p.hasCompleted).length,
      },
    })
    recordApiAvailability('/api/dashboard', 'GET', 200)
    recordApiResponseTime('/api/dashboard', 'GET', Date.now() - start, 200)
    return res
  },
)
