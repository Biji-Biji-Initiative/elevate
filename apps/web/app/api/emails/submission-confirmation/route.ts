import { NextRequest, NextResponse } from 'next/server';
import { sendSubmissionConfirmationEmail } from '@elevate/emails';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, activityName, submissionDate, dashboardUrl } = body;

    // Validate required fields
    if (!email || !name || !activityName || !submissionDate || !dashboardUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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
    console.error('Failed to send submission confirmation email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
