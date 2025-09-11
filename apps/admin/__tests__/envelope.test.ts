import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { parseEnvelope } from '../lib/utils/envelope'

function mockResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('parseEnvelope', () => {
  const Schema = z.object({ success: z.literal(true), data: z.object({ value: z.number() }) })

  it('returns data on valid envelope', async () => {
    const res = mockResponse(true, 200, { success: true, data: { value: 42 } })
    const data = await parseEnvelope(Schema, res, 'Test')
    expect(data.value).toBe(42)
  })

  it('throws on invalid envelope', async () => {
    const res = mockResponse(false, 400, { success: false, error: 'Boom' })
    await expect(parseEnvelope(Schema, res, 'Test')).rejects.toThrow(/Boom|400/)
  })
})
