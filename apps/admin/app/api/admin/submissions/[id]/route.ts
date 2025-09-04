import { type NextRequest, NextResponse } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { createSuccessResponse } from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole('reviewer')
    const { id } = params
    
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
    
    // Derive solely from relational attachments (JSON attachments deprecated)
    const attachmentCount = submission.attachments_rel.length
    return createSuccessResponse({ submission: { ...submission, attachmentCount } })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}
