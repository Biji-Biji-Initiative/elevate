import type { Prisma } from '@prisma/client'

/**
 * Converts a JavaScript value to Prisma JSON format
 * Returns the value as-is for Prisma to handle
 */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  // Prisma handles JSON conversion internally
  // Just return the value as-is
  return value as Prisma.InputJsonValue
}

/**
 * Converts Prisma JSON to a typed JavaScript value  
 * Handles null values
 */
export function fromPrismaJson<T = unknown>(value: Prisma.JsonValue): T | null {
  if (value === null) {
    return null
  }
  
  return value as T
}
