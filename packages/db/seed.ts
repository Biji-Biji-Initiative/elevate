import { ACTIVITY_CODES, USER_ROLES } from '@elevate/types'

import { prisma } from './src/client'
import { toPrismaJson } from './src/utils'

import type { Prisma } from '@prisma/client'

async function main() {
  console.log('🌱 Seeding database...')

  // Seed LEAPS activities
  console.log('📚 Seeding activities...')
  type SeedActivity = {
    code: string
    name: string
    default_points: number
    description: string
  }
  const activities: SeedActivity[] = [
    {
      code: ACTIVITY_CODES[0], // LEARN
      name: 'Learn',
      default_points: 20,
      description: 'Complete AI training courses and earn certificates',
    },
    {
      code: ACTIVITY_CODES[1], // EXPLORE
      name: 'Explore',
      default_points: 50,
      description: 'Apply AI tools in classroom teaching with evidence',
    },
    {
      code: ACTIVITY_CODES[2], // AMPLIFY
      name: 'Amplify',
      default_points: 0, // Variable points based on peer/student count
      description: 'Train other educators and students on AI usage',
    },
    {
      code: ACTIVITY_CODES[3], // PRESENT
      name: 'Present',
      default_points: 20,
      description: 'Share your AI journey publicly on LinkedIn',
    },
    {
      code: ACTIVITY_CODES[4], // SHINE
      name: 'Shine',
      default_points: 0, // Recognition only in MVP
      description: 'Submit innovative AI ideas for recognition',
    },
  ]

  for (const activity of activities) {
    const result = await prisma.activity.upsert({
      where: { code: activity.code },
      update: {
        name: activity.name,
        default_points: activity.default_points,
      },
      create: {
        code: activity.code,
        name: activity.name,
        default_points: activity.default_points,
      },
    })
    console.log(
      `  ✓ ${result.code}: ${result.name} (${result.default_points} points)`,
    )
  }

  // Seed initial badges (optional for MVP)
  console.log('🏆 Seeding badges...')
  type SeedBadge = {
    code: string
    name: string
    description: string
    criteria: Prisma.InputJsonValue
  }
  const badges: SeedBadge[] = [
    {
      code: 'FIRST_LEARN',
      name: 'First Steps',
      description: 'Completed your first Learn activity',
      criteria: toPrismaJson({ activity: ACTIVITY_CODES[0], count: 1 }), // LEARN
    },
    {
      code: 'EXPLORER',
      name: 'AI Explorer',
      description: 'Successfully applied AI in the classroom',
      criteria: toPrismaJson({ activity: ACTIVITY_CODES[1], count: 1 }), // EXPLORE
    },
    {
      code: 'AMPLIFIER',
      name: 'Knowledge Amplifier',
      description: 'Trained 10+ peers or 25+ students',
      criteria: toPrismaJson({
        activity: ACTIVITY_CODES[2], // AMPLIFY
        peers: 10,
        students: 25,
      }),
    },
    {
      code: 'PUBLIC_VOICE',
      name: 'Public Voice',
      description: 'Shared your AI journey publicly',
      criteria: toPrismaJson({ activity: ACTIVITY_CODES[3], count: 1 }), // PRESENT
    },
  ]

  for (const badge of badges) {
    const result = await prisma.badge.upsert({
      where: { code: badge.code },
      update: {
        name: badge.name,
        description: badge.description,
        criteria: toPrismaJson(badge.criteria),
      },
      create: badge,
    })
    console.log(`  ✓ ${result.code}: ${result.name}`)
  }

  // Seed admin user if credentials provided
  const {
    SEED_ADMIN_ID: id,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_NAME: name = 'Admin User',
    SEED_ADMIN_HANDLE: handle = 'admin',
  } = process.env

  if (id && email) {
    console.log('👤 Seeding admin user...')
    const adminUser = await prisma.user.upsert({
      where: { id },
      update: {
        role: USER_ROLES[2] as const, // ADMIN
        email,
        name,
        handle,
      },
      create: {
        id,
        role: USER_ROLES[2] as const, // ADMIN
        email,
        name,
        handle,
      },
    })
    console.log(`  ✓ Admin user: ${adminUser.name} (${adminUser.email})`)
  } else {
    console.log('⏭️  Skipping admin user (no credentials provided)')
    console.log(
      '   Set SEED_ADMIN_ID and SEED_ADMIN_EMAIL in .env.local to create admin user',
    )
  }

  console.log('✅ Database seeding complete!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('❌ Database seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
