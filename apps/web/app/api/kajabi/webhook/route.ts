import crypto from 'crypto';

import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@elevate/db/client';
import { withRateLimit, webhookRateLimiter } from '@elevate/security';
import { parseKajabiWebhook, parseWebhookHeaders, toJsonValue, toPrismaJson, buildAuditMeta, type KajabiTagEvent } from '@elevate/types';

// Local wrapper to ensure type safety for object inputs
function toPrismaJsonObject(obj: object): Exclude<ReturnType<typeof toPrismaJson>, null> {
  const result = toPrismaJson(obj);
  if (result === null) {
    throw new Error('Unexpected null result from non-null object');
  }
  return result;
}

// Local wrapper for audit meta to ensure type safety
function buildAuditMetaSafe(envelope: { entityType: any; entityId: string }, meta?: Record<string, unknown>) {
  const result = buildAuditMeta(envelope, meta);
  if (result === null) {
    throw new Error('Unexpected null result from audit meta');
  }
  return result;
}

export const runtime = 'nodejs';

// Verify webhook signature from Kajabi with timing-safe comparison
function verifySignature(payload: string, signature: string): boolean {
  if (!process.env.KAJABI_WEBHOOK_SECRET) {
    return false;
  }

  if (!signature || signature.length === 0) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Ensure both buffers have the same length before timing-safe comparison
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  // Compare signatures securely
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

// Process tag-based events from Kajabi
async function processTagEvent(eventData: KajabiTagEvent, eventId: string) {
  try {
    const { contact, tag } = eventData;
    
    // Extract contact information
    const email = contact.email?.toLowerCase().trim();
    const contactId = contact.id;
    const tagName = tag.name;

    if (!email || !tagName) {
      throw new Error('Required fields missing: email and tag name');
    }

    // Only process LEARN_COMPLETED tags
    if (tagName !== 'LEARN_COMPLETED') {
      return { success: true, reason: 'tag_not_processed', tag: tagName };
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Store for manual review
      const userNotFoundPayload = toPrismaJsonObject({
        ...eventData,
        processing_status: 'user_not_found',
        stored_at: new Date().toISOString()
      });
      
      await prisma.kajabiEvent.create({
        data: {
          id: eventId,
          payload: userNotFoundPayload
          // processed_at and user_match are omitted (will be null by default)
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
      where: { id: eventId }
    });

    if (existingEvent) {
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
        external_event_id: eventId
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
    const processedEventPayload = toPrismaJsonObject({
      ...eventData,
      processing_status: 'completed',
      processed_at: new Date().toISOString()
    });
    
    await prisma.kajabiEvent.create({
      data: {
        id: eventData.event_id || `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
        payload: processedEventPayload,
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
        meta: buildAuditMetaSafe({ entityType: 'kajabi', entityId: String(eventData.event_id || `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`) }, {
          event_id: eventData.event_id || `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
          tag_name: tagName,
          kajabi_contact_id: contactId,
          points_awarded: learnActivity.default_points
        })
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
    
    // Store failed event for manual review
    try {
      const failedEventPayload = toPrismaJsonObject({
        ...eventData,
        error: error instanceof Error ? error.message : String(error),
        failed_at: new Date().toISOString()
      });
      
      await prisma.kajabiEvent.create({
        data: {
          id: eventData.event_id || `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
          payload: failedEventPayload
          // processed_at and user_match omitted (will be null by default)
        }
      });
    } catch (dbError) {
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting first
  return withRateLimit(request, webhookRateLimiter, async () => {
    try {
      const body = await request.text();
      const headersList = await headers();
      
      // Parse JSON first (we'll validate specific schemas by event type)
      let rawEventData: unknown;
      try {
        rawEventData = JSON.parse(body);
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400 }
        );
      }

      // Parse and validate the initial webhook structure
      const parseResult = parseKajabiWebhook(rawEventData);
      
      // Validate payload structure first
      if (!rawEventData || typeof rawEventData !== 'object') {
        return NextResponse.json(
          { error: 'Invalid webhook payload structure' },
          { status: 400 }
        );
      }

      // Use parsed and validated data from parseResult
      const eventData = parseResult || rawEventData;

      // Compute a stable event fingerprint to ensure idempotency
      const fingerprint = crypto.createHash('sha256').update(body).digest('hex');
      // Prefer provider event_id; otherwise use fingerprint-based ID
      const providerEventId = parseResult?.event_id || 
        (typeof rawEventData === 'object' && rawEventData !== null && 
         'event_id' in rawEventData && typeof (rawEventData as any).event_id === 'string'
         ? (rawEventData as any).event_id
         : undefined);
      const eventType = parseResult?.event_type || 
        (typeof rawEventData === 'object' && rawEventData !== null && 
         'event_type' in rawEventData && typeof (rawEventData as any).event_type === 'string'
         ? (rawEventData as any).event_type
         : undefined);
      const stableEventId = String(providerEventId || `kajabi:${fingerprint}`);
         
      if (stableEventId || eventType) {
        try {
          const auditPayload = toPrismaJsonObject({
            ...(typeof rawEventData === 'object' && rawEventData !== null ? rawEventData : {}),
            received_at: new Date().toISOString(),
            validation_status: parseResult ? 'valid' : 'invalid_format'
          });
          
          await prisma.kajabiEvent.upsert({
            where: { id: stableEventId },
            update: {
              payload: auditPayload
            },
            create: {
              id: stableEventId,
              payload: auditPayload
              // processed_at and user_match omitted (will be null by default)
            }
          });
        } catch (storeError) {
          // Continue processing even if storage fails
        }
      }
      
      // Get signature from headers (format may vary by platform)
      const signature = headersList.get('x-kajabi-signature') || 
                       headersList.get('signature') ||
                       headersList.get('authorization')?.replace('Bearer ', '');

      if (!signature) {
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 401 }
        );
      }

      // Verify webhook signature with enhanced security
      if (!verifySignature(body, signature)) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    

    // Handle different event types
    switch (eventType) {
      case 'contact.tagged':
        // Use the already parsed result
        if (!parseResult) {
          return NextResponse.json(
            { 
              error: 'Invalid contact.tagged event format',
              details: 'Event payload does not match expected KajabiTagEvent schema'
            },
            { status: 400 }
          );
        }
        
        const result = await processTagEvent(parseResult, parseResult.event_id || `kajabi_contact_tagged_${Date.now()}`);
        
        return NextResponse.json({
          success: true,
          event_id: parseResult.event_id || `kajabi_contact_tagged_${Date.now()}`,
          processed_at: new Date().toISOString(),
          result
        });

      case 'form.submitted':
      case 'purchase.created':
        // Store all events for audit but don't process
        const auditOnlyPayload = toPrismaJsonObject({
          ...eventData,
          stored_at: new Date().toISOString(),
          processing_status: 'audit_only'
        });
        
        await prisma.kajabiEvent.create({
          data: {
            id: stableEventId,
            payload: auditOnlyPayload
            // processed_at and user_match omitted (will be null by default)
          }
        });
        
        return NextResponse.json({
          success: true,
          message: `Event type ${String(eventType)} stored for audit`
        });

      default:
        // Store unknown events for audit
        const unknownEventPayload = toPrismaJsonObject({
          ...eventData,
          stored_at: new Date().toISOString(),
          processing_status: 'unknown_event_type'
        });
        
        await prisma.kajabiEvent.create({
          data: {
            id: stableEventId,
            payload: unknownEventPayload
            // processed_at and user_match omitted (will be null by default)
          }
        });
        
        return NextResponse.json({
          success: true,
          message: `Event type ${String(eventType)} stored for audit`
        });
    }

    } catch (error) {
      
      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  });
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
