import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import { 
  createSuccessResponse,
  withApiErrorHandling
} from '@elevate/types'
import {
  AuthenticationError,
  NotFoundError
} from '@elevate/types/errors'

export const runtime = 'nodejs';

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        handle: true,
        school: true,
        cohort: true
      }
    })

    if (!user) {
      throw new NotFoundError('User', userId, context.traceId)
    }

    // Get all user data in parallel for better performance
    const [pointsResult, submissions, earnedBadges] = await Promise.all([
      // Get user's total points
      prisma.pointsLedger.aggregate({
        where: { user_id: userId },
        _sum: { delta_points: true }
      }),
      
      // Get user's submissions with activity details
      prisma.submission.findMany({
        where: { user_id: userId },
        include: {
          activity: true
        },
        orderBy: {
          created_at: 'desc'
        }
      }),
      
      // Get user's earned badges
      prisma.earnedBadge.findMany({
        where: { user_id: userId },
        include: {
          badge: true
        },
        orderBy: {
          earned_at: 'desc'
        }
      })
    ])

    const totalPoints = pointsResult._sum.delta_points || 0

    // Group submissions by activity
    const submissionsByActivity = submissions.reduce<Record<string, typeof submissions>>((acc, submission) => {
      const activityCode = submission.activity_code
      if (!acc[activityCode]) {
        acc[activityCode] = []
      }
      acc[activityCode].push(submission)
      return acc
    }, {})

    // Calculate progress for each LEAPS stage
    const activities = await prisma.activity.findMany({
      orderBy: { code: 'asc' }
    })

    const progress = activities.map(activity => {
      const activitySubmissions = submissionsByActivity[activity.code] || []
      const approvedSubmissions = activitySubmissions.filter(s => s.status === 'APPROVED')
      const pendingSubmissions = activitySubmissions.filter(s => s.status === 'PENDING')
      const rejectedSubmissions = activitySubmissions.filter(s => s.status === 'REJECTED')

      // Calculate points earned from this activity
      const activityPoints = approvedSubmissions.length * activity.default_points

      return {
        activityCode: activity.code,
        activityName: activity.name,
        defaultPoints: activity.default_points,
        pointsEarned: activityPoints,
        submissionCounts: {
          total: activitySubmissions.length,
          approved: approvedSubmissions.length,
          pending: pendingSubmissions.length,
          rejected: rejectedSubmissions.length
        },
        latestSubmission: activitySubmissions[0] || null,
        hasCompleted: approvedSubmissions.length > 0
      }
    })

    // Recent activity (last 5 submissions)
    const recentActivity = submissions.slice(0, 5).map(submission => ({
      id: submission.id,
      activityCode: submission.activity_code,
      activityName: submission.activity.name,
      status: submission.status,
      createdAt: submission.created_at,
      updatedAt: submission.updated_at
    }))

  return createSuccessResponse({
    user: {
      id: user.id,
      name: user.name,
      handle: user.handle,
      school: user.school,
      cohort: user.cohort
    },
    points: {
      total: totalPoints,
      breakdown: progress.reduce<Record<string, number>>((acc, p) => {
        acc[p.activityCode] = p.pointsEarned
        return acc
      }, {})
    },
    progress,
    badges: earnedBadges.map(eb => ({
      code: eb.badge_code,
      name: eb.badge.name,
      description: eb.badge.description,
      iconUrl: eb.badge.icon_url,
      earnedAt: eb.earned_at
    })),
    recentActivity,
    stats: {
      totalSubmissions: submissions.length,
      approvedSubmissions: submissions.filter(s => s.status === 'APPROVED').length,
      pendingSubmissions: submissions.filter(s => s.status === 'PENDING').length,
      completedStages: progress.filter(p => p.hasCompleted).length
    }
  })
})
