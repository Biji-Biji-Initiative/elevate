import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@elevate/db/client'
import { getKajabiClient } from '@elevate/integrations'
import { withRateLimit, webhookRateLimiter } from '@elevate/security'
import type { Role } from '@prisma/client'

export const runtime = 'nodejs';

// This webhook endpoint handles Clerk user events to sync user data
export async function POST(req: NextRequest) {
  // Apply rate limiting first
  return withRateLimit(req, webhookRateLimiter, async () => {
    // Get the headers
    const headerPayload = await headers()
    const svixId = headerPayload.get('svix-id')
    const svixTimestamp = headerPayload.get('svix-timestamp')
    const svixSignature = headerPayload.get('svix-signature')

    // Enhanced header validation
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new NextResponse('Missing required svix headers', {
        status: 400,
      })
    }

    // Validate webhook secret is configured
    if (!process.env.CLERK_WEBHOOK_SECRET) {
      return new NextResponse('Webhook not properly configured', {
        status: 500,
      });
    }

    // Get the body
    let payload: WebhookEvent;
    let body: string;
    
    try {
      payload = await req.json()
      body = JSON.stringify(payload)
    } catch (parseError) {
      return new NextResponse('Invalid JSON payload', {
        status: 400,
      });
    }

    // Store raw event for audit trail (before verification)
    try {
      await prisma.auditLog.create({
        data: {
          actor_id: 'clerk-webhook',
          action: 'WEBHOOK_RECEIVED',
          target_id: payload?.data?.id || 'unknown',
          meta: {
            event_type: payload?.type,
            svix_id: svixId,
            timestamp: svixTimestamp,
            verified: false
          }
        }
      });
    } catch (auditError) {
      // Continue processing
    }

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET)

    let evt: WebhookEvent

    // Verify the webhook payload with enhanced error handling
    try {
      evt = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent
    } catch (err) {
      
      // Log failed verification attempt
      await prisma.auditLog.create({
        data: {
          actor_id: 'clerk-webhook',
          action: 'WEBHOOK_VERIFICATION_FAILED',
          target_id: payload?.data?.id || 'unknown',
          meta: {
            error: err instanceof Error ? err.message : String(err),
            svix_id: svixId,
            event_type: payload?.type
          }
        }
      });
      
      return new NextResponse('Webhook verification failed', {
        status: 401,
      });
    }

  // Handle the webhook event
  const eventType = evt.type
  
  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url, public_metadata } = evt.data
        
        const primaryEmail = email_addresses.find(email => email.id === evt.data.primary_email_address_id)
        const email = primaryEmail?.email_address
        
        if (!email) {
          return new NextResponse('No email address found', { status: 400 })
        }

        // Create a unique handle from email or name
        const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User'
        const baseHandle = (first_name?.toLowerCase() || email.split('@')[0]).replace(/[^a-z0-9]/g, '')
        let handle = baseHandle
        let counter = 1

        // Ensure handle uniqueness
        while (true) {
          try {
            const existingUser = await prisma.user.findUnique({ where: { handle } })
            if (!existingUser || existingUser.id === id) break
            handle = `${baseHandle}${counter++}`
          } catch (error) {
            break
          }
        }

        // Get role from metadata (defaults to PARTICIPANT)
        const role = (public_metadata as Record<string, unknown>)?.role as string || 'PARTICIPANT'
        const validRoles = ['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']
        const userRole = validRoles.includes(role) ? role : 'PARTICIPANT'

        // Upsert user in database
        const upsertedUser = await prisma.user.upsert({
          where: { id },
          update: {
            name,
            email,
            avatar_url: image_url || null,
            role: userRole as Role,
            handle: eventType === 'user.created' ? handle : undefined, // Only update handle on creation
          },
          create: {
            id,
            handle,
            name,
            email,
            avatar_url: image_url || null,
            role: userRole as Role,
          },
        })

        // Enroll user in Kajabi on registration
        if (eventType === 'user.created') {
          try {
            const kajabiClient = getKajabiClient();
            const kajabiContact = await kajabiClient.createOrUpdateContact(email, name);
            
            // Update user with Kajabi contact ID
            await prisma.user.update({
              where: { id },
              data: { kajabi_contact_id: kajabiContact.id.toString() }
            });

            // Create audit log for Kajabi enrollment
            await prisma.auditLog.create({
              data: {
                actor_id: 'system',
                action: 'KAJABI_USER_ENROLLED',
                target_id: id,
                meta: {
                  kajabi_contact_id: kajabiContact.id,
                  email: email,
                  name: name
                }
              }
            });

          } catch (kajabiError) {
            // Don't fail the webhook if Kajabi enrollment fails
            // Log the error for manual follow-up
            await prisma.auditLog.create({
              data: {
                actor_id: 'system',
                action: 'KAJABI_ENROLLMENT_FAILED',
                target_id: id,
                meta: {
                  error: kajabiError instanceof Error ? kajabiError.message : String(kajabiError),
                  email: email,
                  name: name
                }
              }
            });
          }
        }

        break
      }

      case 'user.deleted': {
        const { id } = evt.data
        
        // Note: Instead of deleting, we might want to mark as inactive
        // For GDPR compliance, we'll actually delete the user data
        await prisma.user.delete({
          where: { id: id! },
        })

        break
      }

      default:
    }

    return new NextResponse('Success', { status: 200 })
  } catch (error) {
    
    // Log error for debugging
    await prisma.auditLog.create({
      data: {
        actor_id: 'clerk-webhook',
        action: 'WEBHOOK_ERROR',
        target_id: 'unknown',
        meta: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    });
    
    return new NextResponse('Error processing webhook', { status: 500 })
  }
  });
}