import { NextResponse } from 'next/server'

import { AdminError } from '@/lib/server/admin-error'

export function statusForAdminError(code: AdminError['code']): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'DUPLICATE':
    case 'CONFLICT':
      return 409
    case 'INTEGRATION_FAILED':
      return 502
    case 'INTERNAL':
    default:
      return 500
  }
}

export function toErrorResponse(err: unknown, fallbackMessage = 'Unexpected error') {
  if (err instanceof AdminError) {
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message, ...(err.meta ? { meta: err.meta } : {}) } },
      { status: statusForAdminError(err.code) },
    )
  }
  const msg = err instanceof Error ? err.message : fallbackMessage
  return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: msg } }, { status: 500 })
}

export function toSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

