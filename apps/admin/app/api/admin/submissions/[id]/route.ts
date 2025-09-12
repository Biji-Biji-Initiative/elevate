import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { createSuccessResponse, createErrorResponse, notFound, withApiErrorHandlingParams, type ApiContext } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export const GET = withApiErrorHandlingParams(async (
  request: NextRequest,
  _context: ApiContext,
  { params }: { params: Promise<{ id: string }> },
) => {
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      await requireRole('reviewer')
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
              cohort: true,
            },
          },
          activity: true,
          attachments_rel: true,
        },
      })

      if (!submission) {
        const res = notFound('Submission', id, _context.traceId)
        return res
      }

      // Derive solely from relational attachments (JSON attachments deprecated)
      const attachmentCount = submission.attachments_rel.length
      const res = createSuccessResponse({
        submission: { ...submission, attachmentCount },
      })
      return res
    } catch (error) {
      const res = createErrorResponse(error, 500, _context.traceId)
      return res
    }
  })
})
