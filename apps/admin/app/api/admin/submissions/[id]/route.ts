import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole } from '@elevate/auth/withRole'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole('reviewer')
    const { id } = await params
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            handle: true,
            school: true,
            cohort: true
          }
        },
        activity: true
      }
    })
    
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ submission })
  } catch (error: any) {
    console.error('Error fetching submission:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch submission' },
      { status: error.statusCode || 500 }
    )
  }
}