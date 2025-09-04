import { type NextRequest, NextResponse } from 'next/server';

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers';
import { prisma, type Prisma } from '@elevate/db';
import { createSuccessResponse, createErrorResponse as createHttpError } from '@elevate/http'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { toPrismaJson, parseKajabiWebhook, KajabiReprocessSchema, type KajabiTagEvent, buildAuditMeta } from '@elevate/types';

export const runtime = 'nodejs';

interface ReprocessRequest {
  event_id: string;
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    // Check admin role
    await requireRole('admin');

    const body: unknown = await request.json();
    const parsed = KajabiReprocessSchema.safeParse(body)
    if (!parsed.success) {
      return createHttpError(new Error('Invalid request body'), 400)
    }
    const { event_id } = parsed.data;

    if (!event_id) {
      return createErrorResponse(new Error('event_id is required'), 400)
    }

    // Find the Kajabi event
    const kajabiEvent = await prisma.kajabiEvent.findUnique({
      where: { id: event_id }
    });

    if (!kajabiEvent) {
      return createErrorResponse(new Error('Event not found'), 404)
    }

    if (kajabiEvent.processed_at) {
      return createErrorResponse(new Error('Event already processed'), 400)
    }

    // Parse and validate the event payload
    const eventData = parseKajabiWebhook(kajabiEvent.payload);
    
    if (!eventData) {
      return createErrorResponse(new Error('Invalid event payload format'), 400)
    }

    // Process tag-based events only (same logic as webhook)
    if (eventData.event_type !== 'contact.tagged') {
      return createErrorResponse(new Error('Only contact.tagged events can be reprocessed'), 400)
    }

    const { contact, tag } = eventData;
    
    // Extract contact information
    const email = contact.email?.toLowerCase().trim();
    const contactId = contact.id;
    const tagName = tag.name;

    if (!email || !tagName) {
      return createErrorResponse(new Error('Required fields missing: email and tag name'), 400)
    }

    // Only process LEARN_COMPLETED tags
    if (tagName !== 'LEARN_COMPLETED') {
      return createErrorResponse(new Error('Only LEARN_COMPLETED tags can be reprocessed'), 400)
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return createErrorResponse(new Error('User not found for email: ' + email), 404)
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

      return createSuccessResponse({
        message: 'Event marked as processed (points already awarded)',
        user_id: user.id,
        existing_points: existingLedgerEntry.delta_points
      })
    }

    // Award points for LEARN activity
    const learnActivity = await prisma.activity.findUnique({
      where: { code: 'LEARN' }
    });

    if (!learnActivity) {
      return createErrorResponse(new Error('LEARN activity not found in database'), 500)
    }

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Create points ledger entry
      await tx.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'MANUAL',
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
          payload: toPrismaJson({
            tag_name: tagName,
            kajabi_contact_id: contactId,
            completion_date: new Date().toISOString(),
            provider: 'Kajabi',
            auto_approved: true,
            source: 'reprocess_admin'
          }) as Prisma.InputJsonValue,
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
          meta: buildAuditMeta({ entityType: 'kajabi', entityId: event_id }, {
            event_id: event_id,
            tag_name: tagName,
            kajabi_contact_id: contactId,
            points_awarded: learnActivity.default_points,
            reprocessed_at: new Date().toISOString()
          }) as Prisma.InputJsonValue
        }
      });

      return {
        user_id: user.id,
        points_awarded: learnActivity.default_points,
        tag_name: tagName,
        kajabi_contact_id: contactId
      };
    });

    return createSuccessResponse({
      message: 'Event reprocessed successfully',
      ...result
    })

  } catch (error) {
    return createErrorResponse(error, 500);
  }
  })
}
