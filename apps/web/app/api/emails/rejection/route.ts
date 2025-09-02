import { NextRequest, NextResponse } from 'next/server';
import { sendRejectionNotificationEmail } from '@elevate/emails';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      email, 
      name, 
      activityName, 
      reviewerNote,
      dashboardUrl,
      supportUrl 
    } = body;

    // Validate required fields
    if (!email || !name || !activityName || !reviewerNote || !dashboardUrl || !supportUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send rejection notification email
    const result = await sendRejectionNotificationEmail(
      email,
      name,
      activityName,
      reviewerNote,
      dashboardUrl,
      supportUrl
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
