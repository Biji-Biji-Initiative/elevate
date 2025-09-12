import type { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
// Standardized envelopes: prefer local helpers
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { TRACE_HEADER } from '@elevate/http'
import { enrollUserInKajabi } from '@elevate/integrations'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { withRateLimit, adminRateLimiter } from '@elevate/security'

export const runtime = 'nodejs'

const InviteRequestSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    offerId: z.union([z.string(), z.number()]).optional(),
  })
  .refine((v) => !!v.userId || !!v.email, {
    message: 'userId or email is required',
  })

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, adminRateLimiter, async () => {
    await requireRole('admin')
    const baseLogger = await getSafeServerLogger('admin-kajabi-invite')
    const logger = createRequestLogger(baseLogger, request)
    const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
    try {
      const start = Date.now()
      const json = (await request.json()) as unknown
      const parsed = InviteRequestSchema.safeParse(json)
      if (!parsed.success) {
        return toErrorResponse(
          new AdminError(
            'VALIDATION_ERROR',
            parsed.error.issues?.[0]?.message || 'Invalid body',
          ),
        )
      }
      const {
        userId,
        email: emailInput,
        name: nameInput,
        offerId,
      } = parsed.data

      // Resolve user
      let user = null as null | {
        id: string
        email: string
        name: string | null
      }
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true },
        })
        if (!user) return toErrorResponse(new AdminError('NOT_FOUND', 'User not found'))
      } else if (emailInput) {
        const found = await prisma.user.findUnique({
          where: { email: emailInput.toLowerCase() },
          select: { id: true, email: true, name: true },
        })
        if (found) user = found
      }

      const email = (user?.email || emailInput || '').toLowerCase()
      const name: string =
        (nameInput || user?.name || email.split('@')[0]) ?? ''
      if (!email) return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Email required'))

      const effectiveOfferId = offerId ?? process.env.KAJABI_OFFER_ID

      // Execute enrollment + optional offer grant (v2 client)
      const result = await enrollUserInKajabi(email, name, {
        ...(effectiveOfferId !== undefined ? { offerId: effectiveOfferId } : {}),
      })

      // Upsert Kajabi contact id onto user if we have a user record
      if (user && result.success && result.contactId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { kajabi_contact_id: String(result.contactId) },
        })
      }

      // Fallback/ensure grant via Kajabi v1 OAuth JSON:API if offer provided
      // This supports resolving Offer name → numeric id and grant relationships
      let offerIdResolved: string | number | undefined = effectiveOfferId
      let contactIdResolved: string | number | undefined = result.contactId
      try {
        if (effectiveOfferId !== undefined) {
          const clientId = process.env.KAJABI_API_KEY
          const clientSecret = process.env.KAJABI_CLIENT_SECRET
          if (clientId && clientSecret) {
            // OAuth token
            const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
              }),
            })
            const TokenSchema = z.object({ access_token: z.string().optional() })
            const tokenJsonUnknown: unknown = await tokenRes.json().catch(() => ({}))
            const tokenParsed = TokenSchema.safeParse(tokenJsonUnknown)
            const accessToken = tokenParsed.success ? tokenParsed.data.access_token : undefined
            if (accessToken) {
              const api = async (path: string, method = 'GET', body?: unknown) =>
                fetch(`https://api.kajabi.com/v1${path}`, {
                  method,
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/vnd.api+json',
                    Accept: 'application/vnd.api+json',
                  },
                  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
                })

              // Resolve contact id if missing
              if (!contactIdResolved) {
                const list = await api('/contacts')
                const ContactsSchema = z.object({
                  data: z.array(
                    z.object({
                      id: z.union([z.string(), z.number()]),
                      attributes: z.object({ email: z.string().email().optional() }).partial(),
                    }),
                  ).default([]),
                })
                const listJsonUnknown: unknown = await list.json().catch(() => ({}))
                const contactsParsed = ContactsSchema.safeParse(listJsonUnknown)
                if (contactsParsed.success) {
                  const found = contactsParsed.data.data.find(
                    (c) => (c.attributes.email || '').toLowerCase() === email.toLowerCase(),
                  )
                  if (found) contactIdResolved = String(found.id)
                }
                if (!contactIdResolved) {
                  // Create with site relationship
                  const sites = await api('/sites')
                  const SitesSchema = z.object({
                    data: z.array(z.object({ id: z.union([z.string(), z.number()]) })).default([]),
                  })
                  const siteJsonUnknown: unknown = await sites.json().catch(() => ({}))
                  const sitesParsed = SitesSchema.safeParse(siteJsonUnknown)
                  const siteId = sitesParsed.success && sitesParsed.data.data[0]
                    ? String(sitesParsed.data.data[0].id)
                    : undefined
                  const [firstName, ...rest] = name.split(' ')
                  const lastName = rest.join(' ')
                  const crt = await api('/contacts', 'POST', {
                    data: {
                      type: 'contacts',
                      attributes: { email, first_name: firstName, last_name: lastName },
                      ...(siteId
                        ? { relationships: { site: { data: { type: 'sites', id: siteId } } } }
                        : {}),
                    },
                  })
                  const ContactCreateSchema = z.object({
                    data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
                  })
                  const crtJsonUnknown: unknown = await crt.json().catch(() => ({}))
                  const crtParsed = ContactCreateSchema.safeParse(crtJsonUnknown)
                  if (crtParsed.success && crtParsed.data.data) {
                    contactIdResolved = String(crtParsed.data.data.id)
                  }
                }
              }

              // Resolve offer id if provided as name/slug
              if (typeof effectiveOfferId === 'string' && !/^\d+$/.test(effectiveOfferId)) {
                const off = await api('/offers')
                const OffersSchema = z.object({
                  data: z.array(
                    z.object({
                      id: z.union([z.string(), z.number()]),
                      attributes: z
                        .object({
                          name: z.string().optional(),
                          title: z.string().optional(),
                          product_title: z.string().optional(),
                          offer_title: z.string().optional(),
                          product: z.object({ title: z.string().optional() }).partial().optional(),
                        })
                        .partial(),
                    }),
                  ).default([]),
                })
                const offJsonUnknown: unknown = await off.json().catch(() => ({}))
                const offersParsed = OffersSchema.safeParse(offJsonUnknown)
                if (offersParsed.success) {
                  const match = offersParsed.data.data.find((o) => {
                    const a = o.attributes || {}
                    const candidates = [
                      a.name,
                      a.title,
                      a.product_title,
                      a.offer_title,
                      a.product?.title,
                    ].filter(Boolean) as string[]
                    return candidates.some(
                      (v) => v.toLowerCase() === String(effectiveOfferId).toLowerCase(),
                    )
                  })
                  if (match) offerIdResolved = String(match.id)
                }
              }

              // Attempt grant via relationships if we have both ids
              if (contactIdResolved && offerIdResolved) {
                let rel = await api(`/contacts/${contactIdResolved}/relationships/offers`, 'POST', {
                  data: [{ type: 'offers', id: String(offerIdResolved) }],
                })
                if (!rel.ok) {
                  rel = await api(`/offers/${offerIdResolved}/relationships/contacts`, 'POST', {
                    data: [{ type: 'contacts', id: String(contactIdResolved) }],
                  })
                }
              }
            }
          }
        }
      } catch (e) {
        logger.warn('Kajabi v1 grant fallback failed', { error: e instanceof Error ? e.message : String(e) })
      }

      const meta: Prisma.InputJsonValue = {
        email,
        name,
        offer_id: effectiveOfferId ?? null,
        granted: !!effectiveOfferId && result.success,
        contact_id: result.contactId ?? null,
        error: result.error,
      }
      await prisma.auditLog.create({
        data: {
          actor_id: 'admin',
          action: result.success
            ? 'KAJABI_INVITE_SENT'
            : 'KAJABI_INVITE_FAILED',
          target_id: user?.id ?? email,
          meta,
        },
      })

      if (!result.success) {
        logger.warn('Kajabi invite failed', { email, error: result.error })
        recordApiAvailability('/api/admin/kajabi/invite', 'POST', 502)
        recordApiResponseTime('/api/admin/kajabi/invite', 'POST', Date.now() - start, 502)
        const errRes = toErrorResponse(new AdminError('INTEGRATION_FAILED', result.error || 'Kajabi invite failed'))
        if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
        return errRes
      }

      logger.info('Kajabi invite sent', {
        email,
        contactId: result.contactId || contactIdResolved,
        withOffer: !!effectiveOfferId,
        offerIdResolved,
      })
      const res = toSuccessResponse({
        invited: true,
        contactId: result.contactId || contactIdResolved,
        withOffer: !!effectiveOfferId,
        offerIdResolved,
      })
      if (traceId) res.headers.set(TRACE_HEADER, traceId)
      recordApiAvailability('/api/admin/kajabi/invite', 'POST', 200)
      recordApiResponseTime('/api/admin/kajabi/invite', 'POST', Date.now() - start, 200)
      return res
    } catch (error) {
      logger.error('Kajabi invite exception', error instanceof Error ? error : new Error(String(error)))
      recordApiAvailability('/api/admin/kajabi/invite', 'POST', 500)
      recordApiResponseTime('/api/admin/kajabi/invite', 'POST', 0, 500)
      const errRes = toErrorResponse(error)
      if (traceId) errRes.headers.set(TRACE_HEADER, traceId)
      return errRes
    }
  })
}
