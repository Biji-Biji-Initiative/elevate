export type WebRuntimeConfig = ReturnType<typeof getWebRuntimeConfig>

/**
 * Returns typed, normalized runtime config for the Web app.
 * Safe for server-only code (route handlers, RSC), not for client bundles.
 *
 * Note: This intentionally avoids strict schema parsing to keep
 * tests and local usage flexible. Formal validation is handled
 * elsewhere (scripts/validate-env.js and parse*Env helpers when needed).
 */
export function getWebRuntimeConfig() {
  const enableInternal = String(process.env.ENABLE_INTERNAL_ENDPOINTS || '')
    .toLowerCase() === 'true'
  const allowUnsignedKajabi = String(
    process.env.ALLOW_UNSIGNED_KAJABI_WEBHOOK || '',
  ).toLowerCase() === 'true'

  // Learn completion tags
  const defaultLearnTags = ['elevate-ai-1-completed', 'elevate-ai-2-completed']
  const tagsEnv = (process.env.KAJABI_LEARN_TAGS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const learnTags = tagsEnv.length > 0 ? tagsEnv : defaultLearnTags

  return {
    enableInternalEndpoints: enableInternal,
    cronSecret: process.env.CRON_SECRET || null,
    internalMetricsToken: process.env.INTERNAL_METRICS_TOKEN || null,
    clerkWebhookSecret: process.env.CLERK_WEBHOOK_SECRET || null,
    kajabi: {
      webhookSecret: process.env.KAJABI_WEBHOOK_SECRET || null,
      // Only allow unsigned in explicit opt-in or development, not in tests
      allowUnsigned:
        allowUnsignedKajabi || (process.env.NODE_ENV || '') === 'development',
      offerId: process.env.KAJABI_OFFER_ID || null,
      offerName: process.env.KAJABI_OFFER_NAME || null,
      apiKey: process.env.KAJABI_API_KEY || null,
      clientSecret: process.env.KAJABI_CLIENT_SECRET || null,
      learnTags,
    },
  } as const
}
