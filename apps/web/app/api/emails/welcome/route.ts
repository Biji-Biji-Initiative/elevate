import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@elevate/emails';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, dashboardUrl } = body;

    // Validate required fields
    if (!email || !name || !dashboardUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, dashboardUrl' },
        { status: 400 }
      );
    }

    // Send welcome email
    const result = await sendWelcomeEmail(email, name, dashboardUrl);

    return NextResponse.json({ 
      success: true, 
      messageId: result?.id 
    });

  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
