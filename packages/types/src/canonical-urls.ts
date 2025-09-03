/**
 * Canonical URL utilities to ensure consistent routing
 * These functions guarantee we always use the canonical /u/[handle] format
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://leaps.mereka.org'

/**
 * Get canonical profile path (relative)
 * @param handle - User handle
 * @returns Canonical profile path like /u/john_doe
 */
export function getProfilePath(handle: string): string {
  return `/u/${handle}`
}

/**
 * Get canonical profile URL (absolute)
 * @param handle - User handle
 * @returns Canonical profile URL like https://leaps.mereka.org/u/john_doe
 */
export function getProfileUrl(handle: string): string {
  return `${SITE_URL}/u/${handle}`
}

/**
 * Get canonical metrics path for a LEAPS stage
 * @param stage - LEAPS stage (learn, explore, amplify, present, shine)
 * @returns Canonical metrics path like /metrics/learn
 */
export function getMetricsPath(stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'): string {
  return `/metrics/${stage}`
}

/**
 * Get canonical metrics URL for a LEAPS stage
 * @param stage - LEAPS stage (learn, explore, amplify, present, shine)
 * @returns Canonical metrics URL like https://leaps.mereka.org/metrics/learn
 */
export function getMetricsUrl(stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'): string {
  return `${SITE_URL}/metrics/${stage}`
}

/**
 * Validate if a given URL matches the canonical profile format
 * @param url - URL to validate
 * @returns true if URL matches canonical format
 */
export function isCanonicalProfileUrl(url: string): boolean {
  const regex = new RegExp(`^${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/u/[a-zA-Z0-9_-]+$`)
  return regex.test(url)
}

/**
 * Extract handle from a canonical profile URL
 * @param url - Canonical profile URL
 * @returns Handle string or null if invalid
 */
export function extractHandleFromUrl(url: string): string | null {
  const match = url.match(`^${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/u/([a-zA-Z0-9_-]+)$`)
  return match ? match[1] ?? null : null
}