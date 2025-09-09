/**
 * Type guards and validation utilities for runtime type safety
 */

import type { SubmissionStatus, Role, ActivityCode } from './common'

/**
 * Type guard for SubmissionStatus
 */
export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return (
    typeof value === 'string' &&
    ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'].includes(value)
  )
}

/**
 * Type guard for Role
 */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'].includes(value)
}

/**
 * Type guard for ActivityCode
 */
export function isActivityCode(value: unknown): value is ActivityCode {
  return typeof value === 'string' && ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'].includes(value)
}

/**
 * Type guard for objects with known string keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard for arrays
 */
export function isArray<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false
  if (!itemGuard) return true
  return value.every(itemGuard)
}

/**
 * Safe property accessor with type guard
 */
export function safeGet<T>(
  obj: unknown,
  key: string,
  guard: (value: unknown) => value is T
): T | undefined {
  if (!isRecord(obj)) return undefined
  const value = obj[key]
  return guard(value) ? value : undefined
}

/**
 * Type guard for non-null values
 */
export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Type guard for string values
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for number values
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Narrows unknown to a specific type with validation
 */
export function validate<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): T {
  if (!guard(value)) {
    throw new Error(errorMessage || `Validation failed for value: ${String(value)}`)
  }
  return value
}

/**
 * Safe JSON parsing with type validation
 */
export function safeJsonParse<T>(
  json: string,
  guard: (value: unknown) => value is T
): T | undefined {
  try {
    const parsed: unknown = JSON.parse(json)
    return guard(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Assert that a value is defined (non-null, non-undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined')
  }
}

/**
 * Type-safe exhaustiveness check for union types
 */
export function assertUnreachable(value: never): never {
  throw new Error(`Unreachable code reached with value: ${String(value)}`)
}
