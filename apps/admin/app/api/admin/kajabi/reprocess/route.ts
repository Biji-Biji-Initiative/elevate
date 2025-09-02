import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@elevate/db/client';
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers';

export const runtime = 'nodejs';

interface ReprocessRequest {
  event_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin role
    await requireRole('admin');

    const body: ReprocessRequest = await request.json();
    const { event_id } = body;

    if (!event_id) {
      return NextResponse.json(
        { error: 'event_id is required' },
        { status: 400 }
      );
    }

    // Find the Kajabi event
    const kajabiEvent = await prisma.kajabiEvent.findUnique({
      where: { id: event_id }
    });

    if (!kajabiEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (kajabiEvent.processed_at) {
      return NextResponse.json(
        { error: 'Event already processed' },
        { status: 400 }
      );
    }

    const eventData = kajabiEvent.payload as any;

    // Process tag-based events only (same logic as webhook)
    if (eventData.event_type !== 'contact.tagged') {
      return NextResponse.json(
        { error: 'Only contact.tagged events can be reprocessed' },
        { status: 400 }
      );
    }

    const { contact, tag } = eventData.data;
    
    // Extract contact information
    const email = contact.email?.toLowerCase().trim();
    const contactId = contact.id;
    const tagName = tag.name;

    if (!email || !tagName) {
      return NextResponse.json(
        { error: 'Required fields missing: email and tag name' },
        { status: 400 }
      );
    }

    // Only process LEARN_COMPLETED tags
    if (tagName !== 'LEARN_COMPLETED') {
      return NextResponse.json(
        { error: 'Only LEARN_COMPLETED tags can be reprocessed' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found for email: ' + email },
        { status: 404 }
      );
    }

    // Update user with Kajabi contact ID if not already set
    if (!user.kajabi_contact_id && contactId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { kajabi_contact_id: contactId.toString() }
      });
    }

    // Check if points were already awarded for this event
    const existingLedgerEntry = await prisma.pointsLedger.findFirst({
      where: {
        external_event_id: event_id,
        external_source: 'kajabi'
      }
    });

    if (existingLedgerEntry) {
      // Mark as processed
      await prisma.kajabiEvent.update({
        where: { id: event_id },
        data: {
          processed_at: new Date(),
          user_match: user.id
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Event marked as processed (points already awarded)',
        user_id: user.id,
        existing_points: existingLedgerEntry.delta_points
      });
    }

    // Award points for LEARN activity
    const learnActivity = await prisma.activity.findUnique({
      where: { code: 'LEARN' }
    });

    if (!learnActivity) {
      return NextResponse.json(
        { error: 'LEARN activity not found in database' },
        { status: 500 }
      );
    }

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Create points ledger entry
      await tx.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'REPROCESS',
          delta_points: learnActivity.default_points,
          external_source: 'kajabi',
          external_event_id: event_id
        }
      });

      // Create submission record for audit trail
      await tx.submission.create({
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
            source: 'reprocess_admin'
          },
          attachments: []
        }
      });

      // Mark event as processed
      await tx.kajabiEvent.update({
        where: { id: event_id },
        data: {
          processed_at: new Date(),
          user_match: user.id
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          actor_id: 'admin',
          action: 'KAJABI_EVENT_REPROCESSED',
          target_id: user.id,
          meta: {
            event_id: event_id,
            tag_name: tagName,
            kajabi_contact_id: contactId,
            points_awarded: learnActivity.default_points,
            reprocessed_at: new Date().toISOString()
          }
        }
      });

      return {
        user_id: user.id,
        points_awarded: learnActivity.default_points,
        tag_name: tagName,
        kajabi_contact_id: contactId
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Event reprocessed successfully',
      ...result
    });

  } catch (error) {
    console.error('Error reprocessing Kajabi event:', error);
    return createErrorResponse(error, 500);
  }
}