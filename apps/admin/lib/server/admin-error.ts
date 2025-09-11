export type AdminErrorCode =
  | 'INVALID_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'INTEGRATION_FAILED'
  | 'INTERNAL'

export class AdminError extends Error {
  code: AdminErrorCode
  meta?: Record<string, unknown>

  constructor(code: AdminErrorCode, message: string, meta?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.meta = meta
  }
}

export function asAdminError(err: unknown, fallback: { code?: AdminErrorCode; message?: string } = {}) {
  if (err instanceof AdminError) return err
  const message = err instanceof Error ? err.message : fallback.message || 'Internal error'
  return new AdminError(fallback.code || 'INTERNAL', message)
}

