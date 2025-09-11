import { describe, it, expect } from 'vitest'

import { handleApiError } from '@/lib/error-utils'
import { AdminError, asAdminError } from '@/lib/server/admin-error'

describe('Admin errors and handlers', () => {
  it('AdminError carries code and message', () => {
    const err = new AdminError('NOT_FOUND', 'Missing')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Missing')
  })

  it('asAdminError preserves AdminError and wraps unknown', () => {
    const e1 = new AdminError('DUPLICATE', 'Exists')
    expect(asAdminError(e1).code).toBe('DUPLICATE')
    const e2 = asAdminError('oops', { code: 'INTERNAL', message: 'fallback' })
    expect(e2.code).toBe('INTERNAL')
    expect(e2.message).toBe('fallback')
  })

  it('handleApiError formats errors with context', () => {
    const msg1 = handleApiError(new Error('Boom'), 'Ctx')
    expect(msg1).toBe('Ctx: Boom')
    const msg2 = handleApiError('oops', 'Ctx2')
    expect(msg2).toBe('Ctx2: "oops"')
  })
})

