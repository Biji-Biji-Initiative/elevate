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

