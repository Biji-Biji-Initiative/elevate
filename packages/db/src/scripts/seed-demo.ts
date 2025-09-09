import { prisma } from '../client'
import { toPrismaJson } from '../utils'

async function main() {
  const demoId = 'demo-user-1'
  const email = 'demo@leaps.local'
  const name = 'Demo Educator'
  const handle = 'demo_educator'

  const user = await prisma.user.upsert({
    where: { id: demoId },
    update: { email, name, handle },
    create: { id: demoId, email, name, handle, role: 'PARTICIPANT' },
  })

  const submission = await prisma.submission.upsert({
    where: { id: 'demo-present-1' },
    update: {},
    create: {
      id: 'demo-present-1',
      user_id: user.id,
      activity_code: 'PRESENT',
      status: 'APPROVED',
      visibility: 'PUBLIC',
      payload: toPrismaJson({
        data: {
          linkedinUrl: 'https://www.linkedin.com/in/demo',
          caption: 'Shared my AI classroom story',
          screenshotFile: '',
        },
      }),
    },
  })

  console.log('Seeded demo:', { user: user.id, submission: submission.id })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('demo seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

