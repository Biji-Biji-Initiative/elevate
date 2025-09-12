// Centralized application feature flags and settings.
// Only uses NEXT_PUBLIC_* envs for client-safe consumption.

export const featureFlags = {
  apiDocsEnabled:
    String(process.env.NEXT_PUBLIC_ENABLE_API_DOCS || '').toLowerCase() ===
    'true',
} as const

export type FeatureFlags = typeof featureFlags

// Client-facing application settings (safe for import into RSC/client)
export const appSettings = {
  // Optional Learn portal URL for external site (e.g., Kajabi). When provided,
  // the UI can render a portal link in headers/CTAs.
  learnPortalUrl:
    (process.env.NEXT_PUBLIC_KAJABI_PORTAL_URL || '').trim() || null,
  showLearnPortal:
    ((process.env.NEXT_PUBLIC_KAJABI_PORTAL_URL || '').trim().length ?? 0) > 0,
} as const

export type AppSettings = typeof appSettings
