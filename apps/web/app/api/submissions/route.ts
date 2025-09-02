import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@elevate/db/client'
import { z } from 'zod'

// Submission request schema
const SubmissionRequestSchema = z.object({
  activityCode: z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']),
  payload: z.record(z.any()),
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

    const body = await request.json()
    const validatedData = SubmissionRequestSchema.parse(body)

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
      const totalPeers = recentSubmissions.reduce((sum, sub) => {
        const payload = sub.payload as any
        return sum + (payload.peersTrained || 0)
      }, 0)

      const totalStudents = recentSubmissions.reduce((sum, sub) => {
        const payload = sub.payload as any
        return sum + (payload.studentsTrained || 0)
      }, 0)

      const newPeers = validatedData.payload.peersTrained || 0
      const newStudents = validatedData.payload.studentsTrained || 0

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
        payload: validatedData.payload,
        attachments: validatedData.attachments || [],
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

    // Log the submission creation
    console.log(`New ${validatedData.activityCode} submission created:`, {
      submissionId: submission.id,
      userId: userId,
      userHandle: user.handle,
      activityCode: validatedData.activityCode
    })

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
    console.error('Submission creation error:', error)

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

    const whereClause: any = {
      user_id: userId
    }

    if (activityCode) {
      whereClause.activity_code = activityCode
    }

    if (status) {
      whereClause.status = status
    }

    const submissions = await prisma.submission.findMany({
      where: whereClause,
      include: {
        activity: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: submissions.map(submission => ({
        id: submission.id,
        activityCode: submission.activity_code,
        activityName: submission.activity.name,
        status: submission.status,
        visibility: submission.visibility,
        createdAt: submission.created_at,
        updatedAt: submission.updated_at,
        reviewNote: submission.review_note,
        attachmentCount: Array.isArray(submission.attachments) ? submission.attachments.length : 0
      }))
    })

  } catch (error) {
    console.error('Submissions fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}