type Id = string

export class TxMock {
  private users = new Map<Id, any>()
  private usersByEmail = new Map<string, Id>()
  private usersByKajabi = new Map<string, Id>()
  private points = new Map<string, any>() // key: external_event_id
  private submissions: any[] = []
  private tagGrants = new Set<string>() // key: userId:tag

  // Helpers to seed data
  addUser(row: { id: string; email: string; kajabi_contact_id?: string | null; user_type?: 'EDUCATOR' | 'STUDENT' }) {
    this.users.set(row.id, { ...row, user_type: row.user_type || 'EDUCATOR' })
    this.usersByEmail.set(row.email.toLowerCase(), row.id)
    if (row.kajabi_contact_id) this.usersByKajabi.set(String(row.kajabi_contact_id), row.id)
  }

  // Prisma-like API subset
  user = {
    findUnique: async (args: { where: { id?: string; email?: string; kajabi_contact_id?: string } }) => {
      if (args.where.id) return this.users.get(args.where.id) || null
      if (args.where.email) {
        const id = this.usersByEmail.get(String(args.where.email).toLowerCase())
        return id ? this.users.get(id)! : null
      }
      if (args.where.kajabi_contact_id) {
        const id = this.usersByKajabi.get(String(args.where.kajabi_contact_id))
        return id ? this.users.get(id)! : null
      }
      return null
    },
    update: async (args: { where: { id: string }; data: { kajabi_contact_id?: string } }) => {
      const row = this.users.get(args.where.id)
      if (!row) throw new Error('User not found')
      const updated = { ...row, ...args.data }
      this.users.set(args.where.id, updated)
      if (args.data.kajabi_contact_id) this.usersByKajabi.set(String(args.data.kajabi_contact_id), args.where.id)
      return updated
    },
  }

  pointsLedger = {
    findUnique: async (args: { where: { external_event_id: string } }) => {
      return this.points.get(args.where.external_event_id) || null
    },
    create: async (args: { data: any }) => {
      const id = String(args.data.external_event_id)
      if (this.points.has(id)) throw new Error('Unique constraint violation: external_event_id')
      this.points.set(id, { ...args.data })
      return { ...args.data }
    },
  }

  learnTagGrant = {
    create: async (args: { data: { user_id: string; tag_name: string } }) => {
      const key = `${args.data.user_id}:${args.data.tag_name}`
      if (this.tagGrants.has(key)) throw new Error('Unique constraint violation: learn_tag_grants')
      this.tagGrants.add(key)
      return args.data
    },
  }

  submission = {
    create: async (args: { data: any }) => {
      this.submissions.push({ ...args.data })
      return args.data
    },
  }
}

export function createTxMock() {
  // Use ‘as any’ to satisfy Prisma.TransactionClient in tests without importing Prisma types
  return new TxMock() as unknown as import('@elevate/db').Prisma.TransactionClient
}
