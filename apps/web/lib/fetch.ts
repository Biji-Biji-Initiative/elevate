/**
 * Type-safe fetch wrapper for the web application
 * Eliminates unsafe JSON parsing and provides runtime validation
 */

import { z } from 'zod'

/**
 * Error thrown when a typed fetch operation fails
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: Response,
    public data?: unknown
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

/**
 * Error thrown when response data doesn't match the expected schema
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: z.ZodError
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Configuration options for typed fetch
 */
export interface TypedFetchOptions extends Omit<RequestInit, 'body'> {
  /**
   * Request body - will be JSON.stringified if it's an object
   */
  body?: unknown
  /**
   * Base URL to prepend to relative URLs
   */
  baseURL?: string
  /**
   * Timeout in milliseconds (default: 10000ms)
   */
  timeout?: number
  /**
   * Whether to include credentials (default: 'same-origin')
   */
  credentials?: RequestCredentials
}

/**
 * Type-safe fetch wrapper that validates response data with Zod schemas
 * 
 * @example
 * ```typescript
 * const userSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string().email()
 * })
 * 
 * const user = await typedFetch('/api/users/123', userSchema)
 * // user is now typed as { id: string; name: string; email: string }
 * ```
 */
export async function typedFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  options: TypedFetchOptions = {}
): Promise<T> {
  const {
    body,
    baseURL,
    timeout = 10000,
    credentials = 'same-origin',
    headers = {},
    ...fetchOptions
  } = options

  // Build the full URL
  const fullUrl = baseURL ? new URL(url, baseURL).toString() : url

  // Prepare headers
  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // Prepare body
  let finalBody: string | undefined
  if (body !== undefined) {
    if (typeof body === 'string') {
      finalBody = body
    } else {
      finalBody = JSON.stringify(body)
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const fetchInit: RequestInit = {
      ...fetchOptions,
      credentials,
      headers: finalHeaders,
      signal: controller.signal,
    }
    
    // Only include body if it's defined
    if (finalBody !== undefined) {
      fetchInit.body = finalBody
    }
    
    const response = await fetch(fullUrl, fetchInit)

    clearTimeout(timeoutId)

    // Parse response body
    let responseData: unknown
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json()
      } catch {
        throw new FetchError(
          'Invalid JSON response',
          response.status,
          response
        )
      }
    } else {
      const text = await response.text()
      responseData = text
    }

    // Check for HTTP errors
    if (!response.ok) {
      throw new FetchError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response,
        responseData
      )
    }

    // Validate response data with schema
    try {
      return schema.parse(responseData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Response data validation failed',
          error
        )
      }
      throw error
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    // Handle abort errors (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchError(
        `Request timeout after ${timeout}ms`,
        0,
        {} as Response
      )
    }
    
    // Re-throw our custom errors
    if (error instanceof FetchError || error instanceof ValidationError) {
      throw error
    }
    
    // Wrap other errors
    throw new FetchError(
      error instanceof Error ? error.message : 'Unknown fetch error',
      0,
      {} as Response
    )
  }
}

/**
 * Convenience method for GET requests
 */
export async function get<T>(
  url: string,
  schema: z.ZodType<T>,
  options: Omit<TypedFetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  return typedFetch(url, schema, { ...options, method: 'GET' })
}

/**
 * Convenience method for POST requests
 */
export async function post<T>(
  url: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options: Omit<TypedFetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  return typedFetch(url, schema, { ...options, method: 'POST', body })
}

/**
 * Convenience method for PUT requests
 */
export async function put<T>(
  url: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options: Omit<TypedFetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  return typedFetch(url, schema, { ...options, method: 'PUT', body })
}

/**
 * Convenience method for PATCH requests
 */
export async function patch<T>(
  url: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options: Omit<TypedFetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  return typedFetch(url, schema, { ...options, method: 'PATCH', body })
}

/**
 * Convenience method for DELETE requests
 */
export async function del<T>(
  url: string,
  schema: z.ZodType<T>,
  options: Omit<TypedFetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  return typedFetch(url, schema, { ...options, method: 'DELETE' })
}

/**
 * Common response schemas for API endpoints
 */
export const commonSchemas = {
  /**
   * Standard success response
   */
  success: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }),

  /**
   * Error response
   */
  error: z.object({
    error: z.string(),
    details: z.unknown().optional(),
  }),

  /**
   * Paginated response wrapper
   */
  paginated: <T>(itemSchema: z.ZodType<T>) => z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      pages: z.number(),
    }),
  }),

  /**
   * List response wrapper
   */
  list: <T>(itemSchema: z.ZodType<T>) => z.array(itemSchema),
}

/**
 * Type helper for extracting the type from a schema
 */
export type InferSchema<T extends z.ZodType> = z.infer<T>