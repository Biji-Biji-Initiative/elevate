import { z } from 'zod'

/**
 * Type-safe utility functions for admin client operations
 */

/**
 * Type guard to check if a response is an API error
 */
export function isApiError(response: unknown): response is { success: false; error: string } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response &&
    typeof response.error === 'string'
  )
}

/**
 * Type guard to check if a response is an API success
 */
export function isApiSuccess<T>(
  response: unknown
): response is { success: true; data: T } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true &&
    'data' in response
  )
}

/**
 * Extract data from a validated response or throw an error
 */
export function extractDataOrThrow<T>(
  response: unknown,
  schema: z.ZodSchema<{ success: true; data: T }>,
  context: string
): T {
  if (isApiError(response)) {
    throw new Error(`API Error in ${context}: ${response.error}`)
  }

  try {
    const parsed = schema.parse(response)
    return parsed.data
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid response format in ${context}: ${error.message}`)
    }
    throw new Error(`Unexpected error in ${context}: ${String(error)}`)
  }
}

/**
 * Safe JSON parsing with proper error handling
 */
export function safeJsonParse<T>(jsonString: string): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(jsonString) as T
    return { success: true, data }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON' 
    }
  }
}

/**
 * Utility to clean query parameters, removing undefined and empty values
 */
export function cleanQueryParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(params)) {
    // Include non-empty strings, numbers, booleans, and non-null objects
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'ALL'
    ) {
      cleaned[key] = value
    }
  }
  
  return cleaned
}

/**
 * Type-safe array validation utility
 */
export function ensureArray<T>(value: unknown, fallback: T[] = [] as T[]): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }
  return fallback
}

/**
 * Type-safe number validation utility
 */
export function ensureNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (!isNaN(parsed)) {
      return parsed
    }
  }
  return fallback
}

/**
 * Type-safe string validation utility
 */
export function ensureString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * Utility to validate and convert form data to API parameters
 */
export function validateFormParams<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.issues }
    }
    throw error
  }
}

/**
 * Utility for handling async operations with error boundaries
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  _context: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Debounce utility for search inputs
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

/**
 * Format date strings consistently
 */
export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Format numbers with proper locale formatting
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat('en-US', options).format(value)
  } catch {
    return value.toString()
  }
}

/**
 * Generate a random ID for testing purposes
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Type-safe environment variable getter
 */
export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name]
  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback
    }
    throw new Error(`Environment variable ${name} is required but not set`)
  }
  return value
}

/**
 * Create a type-safe event emitter for component communication
 */
export class TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  private listeners: { [K in keyof TEvents]?: Set<(...args: TEvents[K]) => void> } = {}

  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    const set = (this.listeners[event] ??= new Set())
    set.add(listener)
  }

  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    this.listeners[event]?.delete(listener)
  }

  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    this.listeners[event]?.forEach(listener => listener(...args))
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event) {
      this.listeners[event]?.clear()
    } else {
      this.listeners = {}
    }
  }
}
