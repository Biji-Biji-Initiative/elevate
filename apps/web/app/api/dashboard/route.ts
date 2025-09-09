import type { NextRequest } from 'next/server'

import { auth, clerkClient } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import {
  createSuccessResponse,
  withApiErrorHandling,
  type ApiContext,
} from '@elevate/http'
import { enrollUserInKajabi } from '@elevate/integrations'
import { AuthenticationError } from '@elevate/types/errors'

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(
  async (_request: NextRequest, _context: ApiContext) => {
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
        },
        select: {
          id: true,
          name: true,
          handle: true,
          school: true,
          cohort: true,
        },
      })

      // Best-effort Kajabi enrollment as a safety net; do not block dashboard
      try {
        const emailToUse = email
        const nameToUse = user.name
        const offerId = process.env.KAJABI_OFFER_ID
        if (offerId && offerId.length > 0) {
          const result = await enrollUserInKajabi(emailToUse, nameToUse, {
            offerId,
          })
          // If contact was created, persist kajabi_contact_id for future
          if (result.success && result.contactId) {
            await prisma.user.update({
              where: { id: userId },
              data: { kajabi_contact_id: result.contactId.toString() },
            })
          }
        }
      } catch {
        // swallow errors here; primary path is webhook
      }
    }

    // Get all user data in parallel for better performance
    const [pointsResult, submissions, earnedBadges] = await Promise.all([
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
    ])

    const totalPoints = pointsResult._sum.delta_points || 0

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

      // Calculate points earned from this activity
      const activityPoints =
        approvedSubmissions.length * activity.default_points

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
        hasCompleted: approvedSubmissions.length > 0,
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

    return createSuccessResponse({
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
  },
)
