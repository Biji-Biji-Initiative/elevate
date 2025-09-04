import { type NextRequest, type NextResponse } from 'next/server'


import { auth } from '@clerk/nextjs/server'

import { sendRejectionNotificationEmail } from '@elevate/emails'
import { createSuccessResponse, createErrorResponse, unauthorized, validationError } from '@elevate/http'
import { RejectionEmailSchema } from '@elevate/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()

    if (!userId) return unauthorized()

    const body: unknown = await request.json()
    const parsed = RejectionEmailSchema.safeParse(body)

    if (!parsed.success) return validationError(parsed.error, 'Invalid request body')

    const {
      email,
      name,
      activityName,
      reviewerNote,
      dashboardUrl,
      supportUrl,
    } = parsed.data

    // Send rejection notification email
    const result = await sendRejectionNotificationEmail(
      email,
      name,
      activityName,
      reviewerNote,
      dashboardUrl,
      supportUrl,
    )

    return createSuccessResponse({ messageId: result?.id })
  } catch (error) {
    return createErrorResponse(new Error('Failed to send email'), 500)
  }
}
