import { prisma } from './src/client'

async function makeAdmin() {
  const email = 'gurpeet@biji-biji.com'
  
  try {
    // First check if user exists
    let user = await prisma.user.findFirst({
      where: { email }
    })
    
    if (!user) {
      // Check by handle if email not found
      user = await prisma.user.findFirst({
        where: { handle: 'gurpeet' }
      })
    }
    
    if (!user) {
      console.log('User not found. Let me check all users...')
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, handle: true, role: true }
      })
      console.log('Current users:', allUsers)
      
      // Get Clerk ID for this email
      console.log('\nTo create user, we need the Clerk user ID.')
      console.log('Please sign in first at http://localhost:3000')
      return
    }
    
    console.log(`Found user: ${user.email} (${user.id})`)
    console.log(`Current role: ${user.role}`)
    
    // Update to ADMIN
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        role: 'ADMIN',
        user_type: 'EDUCATOR',
        user_type_confirmed: true
      }
    })
    
    console.log('✓ Updated database user to ADMIN role')
    console.log('\n⚠️  Note: You also need to update Clerk metadata.')
    console.log('Run this command to update Clerk:')
    console.log(`\ncurl -X PATCH https://api.clerk.com/v1/users/${user.id}/metadata \\`)
    console.log(`  -H "Authorization: Bearer $CLERK_SECRET_KEY" \\`)
    console.log(`  -H "Content-Type: application/json" \\`)
    console.log(`  -d '{"public_metadata":{"role":"ADMIN","user_type":"EDUCATOR"}}'`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

void makeAdmin()
