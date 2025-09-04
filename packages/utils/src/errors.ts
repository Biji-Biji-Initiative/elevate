/**
 * Type-safe error handling utilities
 */

export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  
  return defaultMessage
}

export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'UNAUTHORIZED', 401, details)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'FORBIDDEN', 403, details)
    this.name = 'ForbiddenError'
  }
}

export function assertError(value: unknown): asserts value is Error {
  if (!isError(value)) {
    throw new Error('Value is not an Error instance')
  }
}

export function wrapError(error: unknown, message?: string): Error {
  if (isError(error)) {
    if (message) {
      error.message = `${message}: ${error.message}`
    }
    return error
  }
  
  return new Error(message || getErrorMessage(error))
}