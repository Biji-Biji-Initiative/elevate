import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@elevate/db';
import crypto from 'crypto';

// Verify webhook signature from Kajabi
function verifySignature(payload: string, signature: string): boolean {
  if (!process.env.KAJABI_WEBHOOK_SECRET) {
    console.error('KAJABI_WEBHOOK_SECRET not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Compare signatures securely
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Process course completion from Kajabi form submission
async function processCourseCompletion(eventData: any) {
  try {
    const { submission } = eventData.data;
    const fields = submission.fields;

    // Extract required fields from form submission
    const email = fields.email?.toLowerCase().trim();
    const courseName = fields.course_name || fields.certificate_name;
    const completionDate = fields.completion_date || new Date().toISOString();
    const studentName = fields.student_name || fields.name;

    if (!email || !courseName) {
      throw new Error('Required fields missing: email and course_name');
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log(`User not found for email: ${email}`);
      // Store for manual review
      await prisma.kajabiEvent.create({
        data: {
          id: eventData.event_id,
          payload: eventData,
          processed_at: null,
          user_match: null
        }
      });
      return { success: false, reason: 'user_not_found', email };
    }

    // Check for duplicate processing
    const existingEvent = await prisma.kajabiEvent.findUnique({
      where: { id: eventData.event_id }
    });

    if (existingEvent) {
      console.log(`Event already processed: ${eventData.event_id}`);
      return { success: true, reason: 'already_processed' };
    }

    // Award points for LEARN activity
    const learnActivity = await prisma.activity.findUnique({
      where: { code: 'LEARN' }
    });

    if (!learnActivity) {
      throw new Error('LEARN activity not found in database');
    }

    // Create points ledger entry
    await prisma.pointsLedger.create({
      data: {
        user_id: user.id,
        activity_code: 'LEARN',
        source: 'WEBHOOK',
        delta_points: learnActivity.default_points,
        external_source: 'kajabi',
        external_event_id: eventData.event_id
      }
    });

    // Create submission record for audit trail
    await prisma.submission.create({
      data: {
        user_id: user.id,
        activity_code: 'LEARN',
        status: 'APPROVED',
        visibility: 'PRIVATE',
        payload: {
          certificate_name: courseName,
          completion_date: completionDate,
          provider: 'Kajabi',
          auto_approved: true,
          source: 'webhook'
        },
        attachments: []
      }
    });

    // Store processed event
    await prisma.kajabiEvent.create({
      data: {
        id: eventData.event_id,
        payload: eventData,
        processed_at: new Date(),
        user_match: user.id
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: 'system',
        action: 'KAJABI_COMPLETION_PROCESSED',
        target_id: user.id,
        meta: {
          event_id: eventData.event_id,
          course_name: courseName,
          points_awarded: learnActivity.default_points
        }
      }
    });

    return { 
      success: true, 
      user_id: user.id,
      points_awarded: learnActivity.default_points,
      course_name: courseName
    };

  } catch (error) {
    console.error('Error processing course completion:', error);
    
    // Store failed event for manual review
    try {
      await prisma.kajabiEvent.create({
        data: {
          id: eventData.event_id,
          payload: { ...eventData, error: error.message },
          processed_at: null,
          user_match: null
        }
      });
    } catch (dbError) {
      console.error('Failed to store failed event:', dbError);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    
    // Get signature from headers (format may vary by platform)
    const signature = headersList.get('x-kajabi-signature') || 
                     headersList.get('signature') ||
                     headersList.get('authorization')?.replace('Bearer ', '');

    if (!signature) {
      console.log('Missing webhook signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      console.log('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const eventData = JSON.parse(body);
    
    console.log('Kajabi webhook received:', {
      event_id: eventData.event_id,
      event_type: eventData.event_type,
      timestamp: eventData.created_at
    });

    // Handle different event types
    switch (eventData.event_type) {
      case 'form.submitted':
        const result = await processCourseCompletion(eventData);
        
        return NextResponse.json({
          success: true,
          event_id: eventData.event_id,
          processed_at: new Date().toISOString(),
          result
        });

      case 'purchase.created':
        // Handle purchase events if needed
        console.log('Purchase event received - not processed yet');
        return NextResponse.json({
          success: true,
          message: 'Purchase event acknowledged but not processed'
        });

      default:
        console.log(`Unhandled event type: ${eventData.event_type}`);
        return NextResponse.json({
          success: true,
          message: `Event type ${eventData.event_type} acknowledged but not processed`
        });
    }

  } catch (error) {
    console.error('Kajabi webhook error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    webhook_url: '/api/kajabi/webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });
}