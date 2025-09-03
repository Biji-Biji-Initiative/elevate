export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiError = {
  success: false
  error: string
  details?: unknown
}

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { success: true, data }
}

export function apiError(message: string, details?: unknown): ApiError {
  return { success: false, error: message, ...(details !== undefined ? { details } : {}) }
}

/**
 * Type-safe utility for creating headers that can be used with fetch()
 * Ensures proper handling of HeadersInit union type
 */
export function createHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers }
}

/**
 * Type-safe utility for merging headers with potential HeadersInit from options
 * Handles the complex HeadersInit union type properly
 */
export function mergeHeaders(
  baseHeaders: Record<string, string>,
  optionsHeaders?: HeadersInit
): Record<string, string> {
  const merged = { ...baseHeaders }
  
  if (!optionsHeaders) {
    return merged
  }
  
  // Handle Headers object
  if (optionsHeaders instanceof Headers) {
    optionsHeaders.forEach((value, key) => {
      merged[key] = value
    })
    return merged
  }
  
  // Handle string[][] format
  if (Array.isArray(optionsHeaders)) {
    optionsHeaders.forEach(([key, value]) => {
      merged[key] = value
    })
    return merged
  }
  
  // Handle Record<string, string> format
  if (typeof optionsHeaders === 'object') {
    Object.assign(merged, optionsHeaders)
  }
  
  return merged
}

/**
 * Type-safe utility for adding authorization header
 */
export function addAuthHeader(
  headers: Record<string, string>,
  token: string
): Record<string, string> {
  return {
    ...headers,
    'Authorization': `Bearer ${token}`
  }
}

