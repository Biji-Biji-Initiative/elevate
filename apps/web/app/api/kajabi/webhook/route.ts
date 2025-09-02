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

// Process tag-based events from Kajabi
async function processTagEvent(eventData: any) {
  try {
    const { contact, tag } = eventData.data;
    
    // Extract contact information
    const email = contact.email?.toLowerCase().trim();
    const contactId = contact.id;
    const tagName = tag.name;

    if (!email || !tagName) {
      throw new Error('Required fields missing: email and tag name');
    }

    // Only process LEARN_COMPLETED tags
    if (tagName !== 'LEARN_COMPLETED') {
      console.log(`Tag event ignored - not LEARN_COMPLETED: ${tagName}`);
      return { success: true, reason: 'tag_not_processed', tag: tagName };
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

    // Update user with Kajabi contact ID if not already set
    if (!user.kajabi_contact_id && contactId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { kajabi_contact_id: contactId.toString() }
      });
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
          tag_name: tagName,
          kajabi_contact_id: contactId,
          completion_date: new Date().toISOString(),
          provider: 'Kajabi',
          auto_approved: true,
          source: 'tag_webhook'
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
          tag_name: tagName,
          kajabi_contact_id: contactId,
          points_awarded: learnActivity.default_points
        }
      }
    });

    return { 
      success: true, 
      user_id: user.id,
      points_awarded: learnActivity.default_points,
      tag_name: tagName,
      kajabi_contact_id: contactId
    };

  } catch (error) {
    console.error('Error processing tag event:', error);
    
    // Store failed event for manual review
    try {
      await prisma.kajabiEvent.create({
        data: {
          id: eventData.event_id,
          payload: { ...eventData, error: error instanceof Error ? error.message : String(error) },
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
    const headersList = await headers();
    
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
      case 'contact.tagged':
        const result = await processTagEvent(eventData);
        
        return NextResponse.json({
          success: true,
          event_id: eventData.event_id,
          processed_at: new Date().toISOString(),
          result
        });

      case 'form.submitted':
      case 'purchase.created':
        // Store all events for audit but don't process
        await prisma.kajabiEvent.create({
          data: {
            id: eventData.event_id,
            payload: eventData,
            processed_at: null,
            user_match: null
          }
        });
        
        console.log(`Event ${eventData.event_type} stored for audit`);
        return NextResponse.json({
          success: true,
          message: `Event type ${eventData.event_type} stored for audit`
        });

      default:
        // Store unknown events for audit
        await prisma.kajabiEvent.create({
          data: {
            id: eventData.event_id,
            payload: eventData,
            processed_at: null,
            user_match: null
          }
        });
        
        console.log(`Unhandled event type: ${eventData.event_type}`);
        return NextResponse.json({
          success: true,
          message: `Event type ${eventData.event_type} stored for audit`
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