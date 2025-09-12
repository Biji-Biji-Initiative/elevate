// Centralized application feature flags and settings.
// Only uses NEXT_PUBLIC_* envs for client-safe consumption.

export const featureFlags = {
  apiDocsEnabled: String(process.env.NEXT_PUBLIC_ENABLE_API_DOCS || '').toLowerCase() === 'true',
} as const

export type FeatureFlags = typeof featureFlags

