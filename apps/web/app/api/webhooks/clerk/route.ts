import { headers } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { clerkClient, type WebhookEvent } from '@clerk/nextjs/server'
import { Webhook } from 'svix'

import { parseClerkPublicMetadata } from '@elevate/auth'
import type { Prisma as PrismaNS } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import { getKajabiClient, enrollUserInKajabi } from '@elevate/integrations'
import { withRateLimit, webhookRateLimiter } from '@elevate/security'
import { parseRole, parseClerkWebhook, type Role } from '@elevate/types'

import type { UserType as PrismaUserType } from '@prisma/client'

export const runtime = 'nodejs'

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
      })
    }

    // Get the body
    let payload: unknown
    let body: string

    try {
      payload = await req.json()
      body = JSON.stringify(payload)
    } catch (parseError) {
      return new NextResponse('Invalid JSON payload', {
        status: 400,
      })
    }

    // Validate the payload structure early
    const validatedEvent = parseClerkWebhook(payload)
    if (!validatedEvent) {
      return new NextResponse('Invalid Clerk webhook event format', {
        status: 400,
      })
    }

    // Store raw event for audit trail (before verification)
    try {
      const auditMeta: PrismaNS.InputJsonValue = {
        event_type: validatedEvent.type,
        svix_id: svixId,
        timestamp: svixTimestamp,
        verified: false,
      }

      await prisma.auditLog.create({
        data: {
          actor_id: 'clerk-webhook',
          action: 'WEBHOOK_RECEIVED',
          target_id: validatedEvent.data.id,
          meta: auditMeta,
        },
      })
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
      }) as WebhookEvent // Safe cast since we validated the structure earlier
    } catch (err) {
      // Log failed verification attempt
      const failureMeta: PrismaNS.InputJsonValue = {
        error: err instanceof Error ? err.message : String(err),
        svix_id: svixId,
        event_type: validatedEvent.type,
      }

      await prisma.auditLog.create({
        data: {
          actor_id: 'clerk-webhook',
          action: 'WEBHOOK_VERIFICATION_FAILED',
          target_id: validatedEvent.data.id,
          meta: failureMeta,
        },
      })

      return new NextResponse('Webhook verification failed', {
        status: 401,
      })
    }

    // Handle the webhook event
    const eventType = evt.type

    try {
      switch (eventType) {
        case 'user.created':
        case 'user.updated': {
          const {
            id,
            email_addresses,
            first_name,
            last_name,
            image_url,
            public_metadata,
          } = evt.data

          const primaryEmail = email_addresses.find(
            (email) => email.id === evt.data.primary_email_address_id,
          )
          const email = primaryEmail?.email_address

          if (!email) {
            return new NextResponse('No email address found', { status: 400 })
          }

          // Create a unique handle from email or name
          const name =
            `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User'
          const emailParts = email.split('@')
          const baseHandle = (
            first_name?.toLowerCase() ||
            emailParts[0] ||
            'user'
          ).replace(/[^a-z0-9]/g, '')
          let handle = baseHandle
          let counter = 1

          // Ensure handle uniqueness
          while (true) {
            try {
              const existingUser = await prisma.user.findUnique({
                where: { handle },
              })
              if (!existingUser || existingUser.id === id) break
              handle = `${baseHandle}${counter++}`
            } catch (error) {
              break
            }
          }

          // Get role from metadata (defaults to PARTICIPANT)
          const publicMetadata = parseClerkPublicMetadata(public_metadata)
          const userRole =
            parseRole(publicMetadata.role) || ('PARTICIPANT' as Role)
          const userTypeRaw = (
            publicMetadata.user_type || 'EDUCATOR'
          ).toUpperCase()
          const userType: PrismaUserType =
            userTypeRaw === 'STUDENT' ? 'STUDENT' : 'EDUCATOR'

          // Upsert user in database
          const updateData: {
            name: string
            email: string
            avatar_url: string | null
            role: Role
            user_type: PrismaUserType
            handle?: string
          } = {
            name,
            email,
            avatar_url: image_url || null,
            role: userRole,
            user_type: userType,
          }

          // Only include handle field for user creation events
          if (eventType === 'user.created' && handle) {
            updateData.handle = handle
          }

          await prisma.user.upsert({
            where: { id },
            update: updateData,
            create: {
              id,
              handle: handle || 'user',
              name,
              email,
              avatar_url: image_url || null,
              role: userRole,
              user_type: userType,
              // Defer confirmation to onboarding page
              user_type_confirmed: false,
            },
          })

          // Mirror user_type to Clerk if missing or different
          if (publicMetadata.user_type !== userType) {
            try {
              const client = await clerkClient()
              await client.users.updateUser(id, {
                publicMetadata: { ...public_metadata, user_type: userType },
              })
            } catch {
              // ignore
            }
          }

          // Enroll user in Kajabi on registration
          if (eventType === 'user.created') {
            try {
              const kajabiClient = getKajabiClient()
              const kajabiContact = await kajabiClient.createOrUpdateContact(
                email,
                name,
              )

              // Update user with Kajabi contact ID
              await prisma.user.update({
                where: { id },
                data: { kajabi_contact_id: kajabiContact.id.toString() },
              })

              // Attempt to grant offer if configured
              const offerId = process.env.KAJABI_OFFER_ID
              if (offerId && offerId.length > 0) {
                const result = await enrollUserInKajabi(email, name, {
                  offerId,
                })
                const grantMeta: PrismaNS.InputJsonValue = {
                  kajabi_contact_id: kajabiContact.id,
                  email,
                  offer_id: offerId,
                  granted: result.success,
                  error: result.success ? undefined : result.error,
                }
                await prisma.auditLog.create({
                  data: {
                    actor_id: 'system',
                    action: result.success
                      ? 'KAJABI_OFFER_GRANTED'
                      : 'KAJABI_OFFER_GRANT_FAILED',
                    target_id: id,
                    meta: grantMeta,
                  },
                })

                // Fallback: if grant failed or offerId is non-numeric, try Kajabi v1 JSON:API
                if (!result.success || !/^\d+$/.test(offerId)) {
                  try {
                    const clientId = process.env.KAJABI_API_KEY
                    const clientSecret = process.env.KAJABI_CLIENT_SECRET
                    const offerName = process.env.KAJABI_OFFER_NAME
                    if (clientId && clientSecret) {
                      const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                          grant_type: 'client_credentials',
                          client_id: clientId,
                          client_secret: clientSecret,
                        }),
                      })
                      const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
                      const accessToken = tokenJson?.access_token
                      if (accessToken) {
                        const api = async (path: string, method = 'GET', body?: unknown) =>
                          fetch(`https://api.kajabi.com/v1${path}`, {
                            method,
                            headers: {
                              Authorization: `Bearer ${accessToken}`,
                              'Content-Type': 'application/vnd.api+json',
                              Accept: 'application/vnd.api+json',
                            },
                            body: body ? JSON.stringify(body) : null,
                          })

                        // Resolve numeric offer id if possible by name
                        let resolvedOfferId: string | undefined = /^\d+$/.test(offerId)
                          ? offerId
                          : undefined
                        if (!resolvedOfferId && offerName) {
                          const off = await api('/offers')
                          const offJson = (await off.json().catch(() => ({}))) as any
                          const data = Array.isArray(offJson?.data) ? offJson.data : []
                          const match = data.find((o: any) => {
                            const a = o?.attributes || {}
                            const candidates = [a.name, a.title, a.product_title, a.product?.title, a.offer_title]
                            return candidates?.some((v: any) => typeof v === 'string' && v.toLowerCase() === offerName.toLowerCase())
                          })
                          if (match?.id) resolvedOfferId = String(match.id)
                        }

                        if (resolvedOfferId) {
                          // Attempt grant
                          let rel = await api(`/contacts/${kajabiContact.id}/relationships/offers`, 'POST', {
                            data: [{ type: 'offers', id: resolvedOfferId }],
                          })
                          if (!rel.ok) {
                            rel = await api(`/offers/${resolvedOfferId}/relationships/contacts`, 'POST', {
                              data: [{ type: 'contacts', id: String(kajabiContact.id) }],
                            })
                          }
                        }
                      }
                    }
                  } catch {
                    // ignore fallback errors
                  }
                }
              }

              // Create audit log for Kajabi enrollment
              const enrollmentMeta: PrismaNS.InputJsonValue = {
                kajabi_contact_id: kajabiContact.id,
                email: email,
                name: name,
              }

              await prisma.auditLog.create({
                data: {
                  actor_id: 'system',
                  action: 'KAJABI_USER_ENROLLED',
                  target_id: id,
                  meta: enrollmentMeta,
                },
              })
            } catch (kajabiError) {
              // Don't fail the webhook if Kajabi enrollment fails
              // Log the error for manual follow-up
              const enrollmentFailureMeta: PrismaNS.InputJsonValue = {
                error:
                  kajabiError instanceof Error
                    ? kajabiError.message
                    : String(kajabiError),
                email: email,
                name: name,
              }

              await prisma.auditLog.create({
                data: {
                  actor_id: 'system',
                  action: 'KAJABI_ENROLLMENT_FAILED',
                  target_id: id,
                  meta: enrollmentFailureMeta,
                },
              })
            }
          }

          break
        }

        case 'user.deleted': {
          const { id } = evt.data
          if (!id) break
          // Note: Instead of deleting, we might want to mark as inactive
          // For GDPR compliance, we'll actually delete the user data
          await prisma.user.delete({
            where: { id },
          })

          break
        }

        default:
      }

      return new NextResponse('Success', { status: 200 })
    } catch (error) {
      // Log error for debugging
      const errorMeta: PrismaNS.InputJsonValue = {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }

      // Try to get target_id from the payload if available
      let targetId = 'unknown'
      try {
        const parsedPayload = parseClerkWebhook(payload)
        targetId = parsedPayload?.data?.id || 'unknown'
      } catch {
        // Keep default 'unknown'
      }

      await prisma.auditLog.create({
        data: {
          actor_id: 'clerk-webhook',
          action: 'WEBHOOK_ERROR',
          target_id: targetId,
          meta: errorMeta,
        },
      })

      return new NextResponse('Error processing webhook', { status: 500 })
    }
  })
}
