import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { createSuccessResponse, createErrorResponse, notFound, TRACE_HEADER } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      await requireRole('reviewer')
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
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
        const res = notFound('Submission', id, traceId)
        if (traceId) res.headers.set(TRACE_HEADER, traceId)
        return res
      }

      // Derive solely from relational attachments (JSON attachments deprecated)
      const attachmentCount = submission.attachments_rel.length
      const res = createSuccessResponse({
        submission: { ...submission, attachmentCount },
      })
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      return res
    } catch (error) {
      const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
      const res = createErrorResponse(error, 500, traceId)
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      return res
    }
  })
}
