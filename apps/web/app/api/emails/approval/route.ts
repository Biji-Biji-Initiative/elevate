import { type NextRequest, type NextResponse } from 'next/server'


import { auth } from '@clerk/nextjs/server'

import { sendApprovalNotificationEmail } from '@elevate/emails'
import { createSuccessResponse, createErrorResponse, unauthorized, validationError } from '@elevate/http'
import { ApprovalEmailSchema } from '@elevate/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()

    if (!userId) return unauthorized()

    const body: unknown = await request.json()
    const parsed = ApprovalEmailSchema.safeParse(body)

    if (!parsed.success) return validationError(parsed.error, 'Invalid request body')

    const {
      email,
      name,
      activityName,
      pointsAwarded,
      reviewerNote,
      totalPoints,
      leaderboardPosition,
      dashboardUrl,
      leaderboardUrl,
    } = parsed.data

    // Send approval notification email
    const result = await sendApprovalNotificationEmail(
      email,
      name,
      activityName,
      pointsAwarded,
      reviewerNote,
      totalPoints,
      leaderboardPosition,
      dashboardUrl,
      leaderboardUrl,
    )

    return createSuccessResponse({ messageId: result?.id })
  } catch (error) {
    return createErrorResponse(new Error('Failed to send email'), 500)
  }
}
