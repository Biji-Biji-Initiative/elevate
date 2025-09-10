/**
 * Server-side API utilities for Next.js API routes and server components
 */

import ElevateAPIClient from '@elevate/openapi/sdk'

import type { ApiClient } from './client'

export type ServerApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Create a server-side API client instance
 * Uses internal API calls with proper authentication context
 */
export function createServerClient(baseUrl?: string): ApiClient {
  return new ElevateAPIClient({
    baseUrl:
      baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  }) as ApiClient
}

/**
 * Helper to handle API responses with proper error handling for server components
 */
export async function handleServerApiResponse<T>(
  response: Promise<ServerApiResponse<T>>,
): Promise<T> {
  const result = await response
  if (!result.success) {
    throw new Error(
      typeof (result as { error?: unknown }).error === 'string'
        ? (result as { error: string }).error
        : 'API request failed',
    )
  }
  return result.data
}
