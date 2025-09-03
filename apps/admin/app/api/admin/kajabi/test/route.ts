import { randomUUID } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers';
import { prisma, type Prisma } from '@elevate/db';
import { KajabiTestSchema, buildAuditMeta } from '@elevate/types'

export const runtime = 'nodejs';

interface TestKajabiRequest {
  user_email: string;
  course_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin role
    await requireRole('admin');

    const body: unknown = await request.json();
    const parsed = KajabiTestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { user_email, course_name = 'Test Course - Admin Console' } = parsed.data;

    const email = user_email.toLowerCase().trim();

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

    // Generate unique event ID
    const eventId = `test_${randomUUID()}`;

    // Check if user already has LEARN points from Kajabi
    const existingLedgerEntry = await prisma.pointsLedger.findFirst({
      where: {
        user_id: user.id,
        activity_code: 'LEARN',
        external_source: 'kajabi'
      }
    });

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

    // Create test event payload (simulating real Kajabi webhook)
    const testEventData = {
      event_id: eventId,
      event_type: 'contact.tagged',
      created_at: new Date().toISOString(),
      data: {
        contact: {
          id: 'test_contact_' + Date.now(),
          email: user_email,
          first_name: user.name?.split(' ')[0] || 'Test',
          last_name: user.name?.split(' ').slice(1).join(' ') || 'User'
        },
        tag: {
          name: 'LEARN_COMPLETED',
          id: 'test_tag_123'
        }
      },
      source: 'admin_test',
      test_mode: true
    };

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Create points ledger entry
      const pointsEntry = await tx.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'MANUAL',
          delta_points: learnActivity.default_points,
          external_source: 'kajabi',
          external_event_id: eventId
        }
      });

      // Create submission record for audit trail
      const submission = await tx.submission.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          status: 'APPROVED',
          visibility: 'PRIVATE',
          payload: {
            tag_name: 'LEARN_COMPLETED',
            kajabi_contact_id: testEventData.data.contact.id,
            completion_date: new Date().toISOString(),
            provider: 'Kajabi',
            course_name: course_name,
            auto_approved: true,
            source: 'test_admin',
            test_mode: true
          },
          attachments: []
        }
      });

      // Store the test event
      const kajabiEvent = await tx.kajabiEvent.create({
        data: {
          id: eventId,
          payload: testEventData,
          processed_at: new Date(),
          user_match: user.id
        }
      });

      // Create audit log
      const auditLog = await tx.auditLog.create({
        data: {
          actor_id: 'admin_test',
          action: 'KAJABI_TEST_EVENT_CREATED',
          target_id: user.id,
          meta: buildAuditMeta({ entityType: 'kajabi', entityId: eventId }, {
            event_id: eventId,
            tag_name: 'LEARN_COMPLETED',
            course_name: course_name,
            points_awarded: learnActivity.default_points,
            test_mode: true,
            created_at: new Date().toISOString()
          }) as Prisma.InputJsonValue
        }
      });

      return {
        user_id: user.id,
        user_email: email,
        points_awarded: learnActivity.default_points,
        course_name: course_name,
        event_id: eventId,
        submission_id: submission.id,
        points_entry_id: pointsEntry.id,
        kajabi_event_id: kajabiEvent.id,
        audit_log_id: auditLog.id,
        existing_kajabi_points: existingLedgerEntry ? existingLedgerEntry.delta_points : 0
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Test Kajabi event created successfully',
      test_mode: true,
      timestamp: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    return createErrorResponse(error, 500);
  }
}
