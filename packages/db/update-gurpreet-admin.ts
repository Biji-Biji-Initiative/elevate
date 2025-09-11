import { prisma } from './src/client'

async function makeAdmin() {
  const userId = 'user_328teXv7Od0N4I9ck6W7Q65SuaL'
  const email = 'gurpreet@biji-biji.com'
  
  try {
    console.log(`Updating user ${email} to ADMIN...`)
    
    // Update to ADMIN
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { 
        role: 'ADMIN',
        user_type: 'EDUCATOR',
        user_type_confirmed: true
      }
    })
    
    console.log('✓ Updated database user to ADMIN role')
    console.log(`  ID: ${updated.id}`)
    console.log(`  Email: ${updated.email}`)
    console.log(`  Role: ${updated.role}`)
    console.log(`  User Type: ${updated.user_type}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

void makeAdmin()
