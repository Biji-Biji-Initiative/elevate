import { z } from 'zod'

// Kajabi webhook schemas
export const KajabiContactSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const KajabiTagSchema = z.object({
  name: z.string(),
})

export const KajabiTagEventSchema = z.object({
  event_id: z.string().optional(),
  event_type: z.enum(['contact.tagged', 'tag.added', 'tag.removed']),
  contact: KajabiContactSchema,
  tag: KajabiTagSchema,
})

// Clerk webhook schemas
export const ClerkUserDataSchema = z.object({
  id: z.string(),
  object: z.literal('user'),
  username: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  image_url: z.string(),
  has_image: z.boolean(),
  primary_email_address_id: z.string().nullable(),
  primary_phone_number_id: z.string().nullable(),
  primary_web3_wallet_id: z.string().nullable(),
  password_enabled: z.boolean(),
  two_factor_enabled: z.boolean(),
  totp_enabled: z.boolean(),
  backup_code_enabled: z.boolean(),
  email_addresses: z.array(z.object({
    id: z.string(),
    object: z.literal('email_address'),
    email_address: z.string().email(),
    verification: z.object({
      status: z.string(),
      strategy: z.string(),
      attempts: z.number().nullable(),
      expire_at: z.number().nullable(),
    }).nullable(),
    linked_to: z.array(z.unknown()),
  })),
  phone_numbers: z.array(z.unknown()),
  web3_wallets: z.array(z.unknown()),
  external_accounts: z.array(z.object({
    id: z.string(),
    object: z.literal('external_account'),
    provider: z.string(),
    identification_id: z.string(),
    provider_user_id: z.string(),
    approved_scopes: z.string(),
    email_address: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    image_url: z.string(),
    username: z.string().nullable(),
    public_metadata: z.object({
      provider: z.string().optional(),
      emailAddress: z.string().email().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional()
    }).optional(),
    label: z.string().nullable(),
    verification: z.object({
      status: z.string(),
      strategy: z.string(),
      attempts: z.number().nullable(),
      expire_at: z.number().nullable(),
    }).nullable(),
  })),
  created_at: z.number(),
  updated_at: z.number(),
  gender: z.string(),
  birthday: z.string(),
  profile_image_url: z.string(),
  last_sign_in_at: z.number().nullable(),
  banned: z.boolean(),
  locked: z.boolean(),
  lockout_expires_in_seconds: z.number().nullable(),
  verification_attempts_remaining: z.number(),
  public_metadata: z.object({
    role: z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']).optional(),
    profileVisible: z.boolean().optional(),
    onboardingCompleted: z.boolean().optional()
  }).optional(),
  private_metadata: z.object({
    internalNotes: z.string().optional(),
    migrationFlags: z.record(z.boolean()).optional()
  }).optional(),
  unsafe_metadata: z.object({
    temporaryData: z.record(z.string()).optional()
  }).optional(),
})

export const ClerkWebhookEventSchema = z.object({
  data: ClerkUserDataSchema,
  object: z.literal('event'),
  type: z.enum([
    'user.created',
    'user.updated',
    'user.deleted',
    'session.created',
    'session.ended',
    'session.removed',
    'session.revoked',
  ]),
})

// Inferred types
export type KajabiContact = z.infer<typeof KajabiContactSchema>
export type KajabiTag = z.infer<typeof KajabiTagSchema>
export type KajabiTagEvent = z.infer<typeof KajabiTagEventSchema>
export type ClerkUserData = z.infer<typeof ClerkUserDataSchema>
export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookEventSchema>

// Webhook parser functions
export function parseKajabiWebhook(payload: unknown): KajabiTagEvent | null {
  const result = KajabiTagEventSchema.safeParse(payload)
  return result.success ? result.data : null
}

export function parseClerkWebhook(payload: unknown): ClerkWebhookEvent | null {
  const result = ClerkWebhookEventSchema.safeParse(payload)
  return result.success ? result.data : null
}

// Generic webhook validation
export const WebhookHeadersSchema = z.object({
  'x-webhook-signature': z.string().optional(),
  'clerk-signature': z.string().optional(),
  'kajabi-signature': z.string().optional(),
  'user-agent': z.string().optional(),
  'content-type': z.string().optional(),
})

export type WebhookHeaders = z.infer<typeof WebhookHeadersSchema>

export function parseWebhookHeaders(headers: unknown): WebhookHeaders | null {
  const result = WebhookHeadersSchema.safeParse(headers)
  return result.success ? result.data : null
}