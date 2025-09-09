export type ErrorEnvelopeType =
  | 'validation'
  | 'cap'
  | 'state'
  | 'auth'
  | 'idempotency'

export interface ErrorEnvelope {
  type: ErrorEnvelopeType
  code: string
  message: string
  details?: Record<string, unknown>
}
