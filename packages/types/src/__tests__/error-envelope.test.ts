import { expectTypeOf, describe, it } from 'vitest'

import type { ErrorEnvelope } from '../error-envelope'

describe('ErrorEnvelope', () => {
  it('matches spec', () => {
    expectTypeOf<ErrorEnvelope>().toMatchTypeOf<{
      type: 'validation' | 'cap' | 'state' | 'auth' | 'idempotency'
      code: string
      message: string
      details?: Record<string, unknown>
    }>()
  })
})
