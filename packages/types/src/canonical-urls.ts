/**
 * Canonical URL utilities to ensure consistent routing
 * These functions guarantee we always use the canonical /u/[handle] format
 * 
 * Environment-aware URL generation:
 * - Development: Uses localhost:3000
 * - Production: Requires NEXT_PUBLIC_SITE_URL to be set
 * - Always normalizes trailing slashes and validates handles
 */

import { HandleSchema } from './domain-constants'

/**
 * Get the base site URL with proper environment handling
 * @returns Base site URL with normalized trailing slash handling
 */
function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  
  // In production, NEXT_PUBLIC_SITE_URL must be explicitly set
  if (process.env.NODE_ENV === 'production') {
    if (!url) {
      throw new Error('NEXT_PUBLIC_SITE_URL is required in production')
    }
  }
  
  // Default to localhost in development
  const baseUrl = url || 'http://localhost:3000'
  
  // Normalize trailing slashes - remove any trailing slash for consistent URL construction
  return baseUrl.replace(/\/+$/, '')
}

/**
 * Validate and encode handle for URL safety
 * @param handle - User handle to validate and encode
 * @returns URL-safe encoded handle
 * @throws Error if handle is invalid
 */
function validateAndEncodeHandle(handle: string): string {
  // Validate handle format using the canonical schema
  const validationResult = HandleSchema.safeParse(handle)
  if (!validationResult.success) {
    throw new Error(`Invalid handle format: ${validationResult.error.issues[0]?.message}`)
  }
  
  // URL encode the handle for safety (handles special characters properly)
  return encodeURIComponent(handle)
}

/**
 * Get canonical profile path (relative)
 * @param handle - User handle
 * @returns Canonical profile path like /u/john_doe
 * @throws Error if handle is invalid
 */
export function getProfilePath(handle: string): string {
  const encodedHandle = validateAndEncodeHandle(handle)
  return `/u/${encodedHandle}`
}

/**
 * Get canonical profile URL (absolute)
 * @param handle - User handle
 * @returns Canonical profile URL like https://leaps.mereka.org/u/john_doe
 * @throws Error if handle is invalid or site URL not configured in production
 */
export function getProfileUrl(handle: string): string {
  const siteUrl = getSiteUrl()
  const profilePath = getProfilePath(handle)
  
  // Use URL class for proper URL construction
  return new URL(profilePath, siteUrl).toString()
}

/**
 * Get canonical metrics path for a LEAPS stage
 * @param stage - LEAPS stage (learn, explore, amplify, present, shine)
 * @returns Canonical metrics path like /metrics/learn
 */
export function getMetricsPath(stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'): string {
  // Validate stage parameter
  const validStages = ['learn', 'explore', 'amplify', 'present', 'shine'] as const
  if (!validStages.includes(stage)) {
    throw new Error(`Invalid stage: ${stage}. Must be one of: ${validStages.join(', ')}`)
  }
  
  return `/metrics/${stage}`
}

/**
 * Get canonical metrics URL for a LEAPS stage
 * @param stage - LEAPS stage (learn, explore, amplify, present, shine)
 * @returns Canonical metrics URL like https://leaps.mereka.org/metrics/learn
 * @throws Error if stage is invalid or site URL not configured in production
 */
export function getMetricsUrl(stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'): string {
  const siteUrl = getSiteUrl()
  const metricsPath = getMetricsPath(stage)
  
  // Use URL class for proper URL construction
  return new URL(metricsPath, siteUrl).toString()
}

/**
 * Validate if a given URL matches the canonical profile format
 * @param url - URL to validate
 * @returns true if URL matches canonical format
 */
export function isCanonicalProfileUrl(url: string): boolean {
  try {
    const siteUrl = getSiteUrl()
    const parsedUrl = new URL(url)
    const expectedBase = new URL(siteUrl)
    
    // Check if base URL matches
    if (parsedUrl.origin !== expectedBase.origin) {
      return false
    }
    
    // Check if path matches /u/[handle] format
    const pathMatch = parsedUrl.pathname.match(/^\/u\/([^\/]+)$/)
    if (!pathMatch) {
      return false
    }
    
    // Validate the handle part
    const handlePart = pathMatch[1]
    if (!handlePart) {
      return false
    }
    const handle = decodeURIComponent(handlePart)
    return HandleSchema.safeParse(handle).success
  } catch {
    return false
  }
}

/**
 * Extract handle from a canonical profile URL
 * @param url - Canonical profile URL
 * @returns Handle string or null if invalid
 */
export function extractHandleFromUrl(url: string): string | null {
  try {
    const siteUrl = getSiteUrl()
    const parsedUrl = new URL(url)
    const expectedBase = new URL(siteUrl)
    
    // Check if base URL matches
    if (parsedUrl.origin !== expectedBase.origin) {
      return null
    }
    
    // Extract handle from path
    const pathMatch = parsedUrl.pathname.match(/^\/u\/([^\/]+)$/)
    if (!pathMatch) {
      return null
    }
    
    // Decode and validate handle
    const handlePart = pathMatch[1]
    if (!handlePart) {
      return null
    }
    const handle = decodeURIComponent(handlePart)
    const validationResult = HandleSchema.safeParse(handle)
    
    return validationResult.success ? handle : null
  } catch {
    return null
  }
}