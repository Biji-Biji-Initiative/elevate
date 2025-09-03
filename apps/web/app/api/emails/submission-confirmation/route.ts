import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import { sendSubmissionConfirmationEmail } from '@elevate/emails';
import { SubmissionConfirmationEmailSchema } from '@elevate/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = SubmissionConfirmationEmailSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, name, activityName, submissionDate, dashboardUrl } = parsed.data;

    // Send submission confirmation email
    const result = await sendSubmissionConfirmationEmail(
      email,
      name,
      activityName,
      submissionDate,
      dashboardUrl
    );

    return NextResponse.json({ 
      success: true, 
      messageId: result?.id 
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
