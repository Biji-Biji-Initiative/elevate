/**
 * @elevate/api-client
 *
 * Type-safe API client for the Elevate Indonesia platform.
 * Provides both client-side and server-side API access with full TypeScript support.
 */

// Client exports
export { createClient, handleApiResponse, type ApiResponse } from './client'

// Server exports
export {
  createServerClient,
  handleServerApiResponse,
  type ServerApiResponse,
} from './server'

// Shared ApiClient type (re-export from client)
export { type ApiClient } from './client'

// OpenAPI SDK types
export type * from '@elevate/openapi/sdk'
