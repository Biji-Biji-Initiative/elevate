/**
 * Client-side API utilities for browser/React components
 */

import ElevateAPIClient from '@elevate/openapi/sdk'

export type ApiClient = InstanceType<typeof ElevateAPIClient>
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

/**
 * Create a client-side API client instance
 * Uses fetch with credentials and CSRF protection
 */
export function createClient(baseUrl?: string): ApiClient {
  const ClientCtor = ElevateAPIClient as unknown as new (config: { baseUrl?: string }) => ApiClient
  return new ClientCtor({ baseUrl: baseUrl || '/api' })
}

/**
 * Default client instance for convenience
 */
// Export a factory; avoid default singletons for better testability

/**
 * Helper to handle API responses with proper error handling
 */
export async function handleApiResponse<T>(response: Promise<ApiResponse<T>>): Promise<T> {
  const result = await response
  if (!result.success) {
    const err = (result as { error?: unknown }).error
    const message = typeof err === 'string' ? err : 'API request failed'
    throw new Error(message)
  }
  return result.data
}

