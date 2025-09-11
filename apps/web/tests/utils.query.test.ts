import { describe, it, expect } from 'vitest'

import { buildQueryString, buildSearchParams } from '../lib/utils/query'
import { safeJsonParse } from '../lib/utils/safe-json'

describe('buildQueryString', () => {
  it('skips undefined and null', () => {
    const qs = buildQueryString({ a: '1', b: undefined, c: null, d: 0, e: false })
    expect(qs).toContain('a=1')
    expect(qs).toContain('d=0')
    expect(qs).toContain('e=false')
    expect(qs).not.toContain('b=')
    expect(qs).not.toContain('c=')
  })

  it('encodes values as strings', () => {
    const qs = buildQueryString({ q: 'hello world', limit: 10 })
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBe('hello world')
    expect(params.get('limit')).toBe('10')
  })
})

describe('buildSearchParams', () => {
  it('returns URLSearchParams with filtered entries', () => {
    const params = buildSearchParams({ x: 'y', z: undefined })
    expect(params.get('x')).toBe('y')
    expect(params.has('z')).toBe(false)
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const text = '{"a":1}'
    const obj = safeJsonParse<{ a: number }>(text)
    expect(obj?.a).toBe(1)
  })

  it('returns undefined for invalid JSON', () => {
    const obj = safeJsonParse('not json')
    expect(obj).toBeUndefined()
  })
})

