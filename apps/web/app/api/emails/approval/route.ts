import { NextRequest, NextResponse } from 'next/server';
import { sendApprovalNotificationEmail } from '@elevate/emails';
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
      pointsAwarded, 
      reviewerNote, 
      totalPoints,
      leaderboardPosition,
      dashboardUrl,
      leaderboardUrl 
    } = body;

    // Validate required fields
    if (!email || !name || !activityName || pointsAwarded === undefined || 
        !totalPoints || !leaderboardPosition || !dashboardUrl || !leaderboardUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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
      leaderboardUrl
    );

    return NextResponse.json({ 
      success: true, 
      messageId: result?.id 
    });

  } catch (error) {
    console.error('Failed to send approval notification email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
