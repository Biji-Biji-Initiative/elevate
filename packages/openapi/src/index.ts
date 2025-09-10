/**
 * Main exports for the @elevate/openapi package
 *
 * Provides OpenAPI specification, schemas, and type-safe utilities
 * All public subpaths are re-exported here for a single API surface
 */

// Main entrypoint is intentionally minimal for API Extractor compatibility.
// Rich surfaces are available via subpath exports: /schemas, /sdk, /client, /examples.
export { getOpenApiSpec } from './spec'
export {
  ElevateAPIClient,
  type SubmissionPayload,
  type ActivityCode,
  type SubmissionStatus,
  type Visibility,
} from './sdk'

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
