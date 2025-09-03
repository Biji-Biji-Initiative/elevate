import { describe, it, expect } from 'vitest'
import { AdminUsersQuerySchema, AdminSubmissionsQuerySchema } from '../src/query-schemas'

describe('Admin query schemas', () => {
  it('parses valid users query with defaults', () => {
    const parsed = AdminUsersQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(50)
    expect(parsed.role).toBe('ALL')
  })

  it('rejects invalid role', () => {
    const result = AdminUsersQuerySchema.safeParse({ role: 'WRONG' })
    expect(result.success).toBe(false)
  })

  it('parses valid submissions query', () => {
    const parsed = AdminSubmissionsQuerySchema.parse({ status: 'PENDING', page: '2', limit: '10' })
    expect(parsed.page).toBe(2)
    expect(parsed.limit).toBe(10)
    expect(parsed.status).toBe('PENDING')
  })

  it('rejects invalid submissions sortBy', () => {
    const res = AdminSubmissionsQuerySchema.safeParse({ sortBy: 'email' })
    expect(res.success).toBe(false)
  })
})

