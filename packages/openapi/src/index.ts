/**
 * Main exports for the @elevate/openapi package
 *
 * Provides OpenAPI specification, schemas, and type-safe utilities
 * All public subpaths are re-exported here for a single API surface
 */

// Re-export spec and schemas
export { openApiSpec } from './spec'
export * from './schemas'

// Re-export SDK (avoiding conflicts with client types)
export {
  ElevateAPIClient,
  type SubmissionPayload,
  type ActivityCode,
  type SubmissionStatus,
  type Visibility,
} from './sdk'

// Re-export client types (OpenAPI generated)
export type { paths, components, operations, webhooks } from './client'

// Re-export examples
export * from './examples'

// Type helpers for API responses
export type APIResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  details?: unknown[]
}

export type PaginatedResponse<T = unknown> = APIResponse<T[]> & {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
