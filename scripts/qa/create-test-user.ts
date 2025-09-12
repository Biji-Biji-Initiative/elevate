#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

function arg(name: string, def?: string) {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  const env = process.env[name.toUpperCase()]
  return env ?? def
}

async function main() {
  const email = arg('email')
  if (!email) throw new Error('Missing --email <email>')
  const contact = arg('contact')
  const role = (arg('role', 'PARTICIPANT') || 'PARTICIPANT').toUpperCase() as
    | 'PARTICIPANT'
    | 'REVIEWER'
    | 'ADMIN'
    | 'SUPERADMIN'
  const handle = arg('handle', email.split('@')[0])
  const name = arg('name', 'QA Test User')
  const userType = (arg('userType', 'EDUCATOR') || 'EDUCATOR').toUpperCase() as
    | 'EDUCATOR'
    | 'STUDENT'

  const id = `test-user-${Date.now()}`

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  const existing = await prisma.user.findUnique({ where: { email } })
  let user
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        handle: existing.handle || handle,
        name,
        role,
        user_type: userType,
        user_type_confirmed: true,
        kajabi_contact_id: contact ?? existing.kajabi_contact_id,
      },
    })
  } else {
    user = await prisma.user.create({
      data: {
        id,
        handle,
        name,
        email,
        role,
        user_type: userType,
        user_type_confirmed: true,
        kajabi_contact_id: contact ?? null,
      },
    })
  }

  console.log({
    id: user.id,
    email: user.email,
    role: user.role,
    user_type: user.user_type,
    kajabi_contact_id: user.kajabi_contact_id,
  })
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
