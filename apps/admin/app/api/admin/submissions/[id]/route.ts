import { type NextRequest, NextResponse } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'

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
        activity: true,
        attachments_rel: true
      }
    })
    
    if (!submission) {
      return createErrorResponse(new Error('Submission not found'), 404)
    }
    
    const attachmentCount = Array.isArray(submission.attachments_rel) && submission.attachments_rel.length > 0
      ? submission.attachments_rel.length
      : (Array.isArray(submission.attachments) ? (submission.attachments as unknown[]).length : 0)
    return NextResponse.json({ success: true, data: { submission: { ...submission, attachmentCount } } })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}
