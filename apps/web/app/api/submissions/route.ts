import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { prisma } from '@elevate/db/client'
import { parseActivityCode, parseSubmissionStatus, parseAmplifyPayload, parseSubmissionPayload, toJsonValue, toPrismaJson, type SubmissionWhereClause } from '@elevate/types'

// Local wrapper to ensure type safety for object inputs to Prisma JSON fields
function toPrismaJsonObject(obj: any): Exclude<ReturnType<typeof toPrismaJson>, null> {
  const result = toPrismaJson(obj);
  if (result === null) {
    throw new Error('Unexpected null result from non-null object');
  }
  return result;
}

import type { Submission, Activity } from '@prisma/client'

type SubmissionWithActivity = Submission & {
  activity: Activity
}

export const runtime = 'nodejs';

// Submission request schema
const SubmissionRequestSchema = z.object({
  activityCode: z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']),
  payload: z.record(z.unknown()),
  attachments: z.array(z.string()).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional()
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body: unknown = await request.json()
    const validatedData = SubmissionRequestSchema.parse(body)

    // Validate payload structure against activity-specific schema
    const payloadValidation = parseSubmissionPayload({
      activityCode: validatedData.activityCode,
      data: validatedData.payload,
    })
    if (!payloadValidation) {
      return NextResponse.json({ error: 'Invalid payload for selected activity' }, { status: 400 })
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { code: validatedData.activityCode }
    })

    if (!activity) {
      return NextResponse.json({ error: 'Invalid activity code' }, { status: 400 })
    }

    // Check for existing pending/approved submissions for certain activities
    if (['LEARN'].includes(validatedData.activityCode)) {
      const existingSubmission = await prisma.submission.findFirst({
        where: {
          user_id: userId,
          activity_code: validatedData.activityCode,
          status: { in: ['PENDING', 'APPROVED'] }
        }
      })

      if (existingSubmission) {
        return NextResponse.json({ 
          error: `You already have a ${existingSubmission.status.toLowerCase()} ${validatedData.activityCode} submission` 
        }, { status: 400 })
      }
    }

    // For Amplify submissions, check 7-day rolling limits
    if (validatedData.activityCode === 'AMPLIFY') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentSubmissions = await prisma.submission.findMany({
        where: {
          user_id: userId,
          activity_code: 'AMPLIFY',
          created_at: {
            gte: sevenDaysAgo
          }
        }
      })

      // Calculate total peers and students trained in last 7 days
      const totalPeers = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: sub.payload })
        return sum + (parsedPayload?.data.peersTrained || 0)
      }, 0)

      const totalStudents = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: sub.payload })
        return sum + (parsedPayload?.data.studentsTrained || 0)
      }, 0)

      // Parse the new submission payload
      const newPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: validatedData.payload })
      if (!newPayload) {
        return NextResponse.json({ 
          error: 'Invalid AMPLIFY payload format' 
        }, { status: 400 })
      }
      
      const newPeers = newPayload.data.peersTrained || 0
      const newStudents = newPayload.data.studentsTrained || 0

      if (totalPeers + newPeers > 50) {
        return NextResponse.json({ 
          error: `Peer training limit exceeded. You've trained ${totalPeers} peers in the last 7 days. Maximum allowed: 50.` 
        }, { status: 400 })
      }

      if (totalStudents + newStudents > 200) {
        return NextResponse.json({ 
          error: `Student training limit exceeded. You've trained ${totalStudents} students in the last 7 days. Maximum allowed: 200.` 
        }, { status: 400 })
      }
    }

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        user_id: userId,
        activity_code: validatedData.activityCode,
        payload: toPrismaJsonObject(validatedData.payload),
        attachments: toPrismaJsonObject(validatedData.attachments || []),
        visibility: validatedData.visibility || 'PRIVATE'
      },
      include: {
        activity: true,
        user: {
          select: {
            name: true,
            handle: true
          }
        }
      }
    })

    // Persist attachments as relational rows (in addition to JSON for backward compatibility)
    if (Array.isArray(validatedData.attachments) && validatedData.attachments.length > 0) {
      const values = validatedData.attachments
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => ({ submission_id: submission.id, path: p }))
      if (values.length > 0) {
        await prisma.submissionAttachment.createMany({ data: values, skipDuplicates: true })
      }
    }


    return NextResponse.json({
      success: true,
      data: {
        id: submission.id,
        activityCode: submission.activity_code,
        status: submission.status,
        visibility: submission.visibility,
        createdAt: submission.created_at,
        potentialPoints: activity.default_points
      }
    })

  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const activityCode = url.searchParams.get('activity')
    const status = url.searchParams.get('status')

    const whereClause: SubmissionWhereClause = {
      user_id: userId
    }

    if (activityCode) {
      const parsedActivity = parseActivityCode(activityCode)
      if (parsedActivity) {
        whereClause.activity_code = parsedActivity
      }
    }

    if (status) {
      const parsedStatus = parseSubmissionStatus(status)
      if (parsedStatus) {
        whereClause.status = parsedStatus
      }
    }

    const submissions = await prisma.submission.findMany({
      where: whereClause,
      include: {
        activity: true,
        attachments_rel: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: submissions.map((submission: SubmissionWithActivity) => ({
        id: submission.id,
        activityCode: submission.activity_code,
        activityName: submission.activity.name,
        status: submission.status,
        visibility: submission.visibility,
        createdAt: submission.created_at,
        updatedAt: submission.updated_at,
        reviewNote: submission.review_note,
        attachmentCount: submission.attachments_rel ? submission.attachments_rel.length : (Array.isArray(submission.attachments) ? submission.attachments.length : 0)
      }))
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
