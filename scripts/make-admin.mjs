import { createClerkClient } from '@clerk/backend'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
})

async function makeAdmin() {
  const email = 'gurpeet@biji-biji.com'
  
  try {
    console.log('Looking up user in Clerk...')
    
    // Get Clerk users
    const clerkUsers = await clerkClient.users.getUserList({
      emailAddress: [email]
    })
    
    if (clerkUsers.data.length === 0) {
      console.error('User not found in Clerk. Please sign up first.')
      return
    }
    
    const clerkUser = clerkUsers.data[0]
    console.log(`Found Clerk user: ${clerkUser.id}`)
    
    // Update Clerk metadata
    await clerkClient.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role: 'ADMIN',
        user_type: 'EDUCATOR'
      }
    })
    console.log('✓ Updated Clerk metadata to ADMIN role')
    
    // Check/create database user
    let user = await prisma.user.findFirst({
      where: { email }
    })
    
    if (!user) {
      console.log('Creating user in database...')
      user = await prisma.user.create({
        data: {
          id: clerkUser.id,
          email: email,
          name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'Admin User',
          handle: email.split('@')[0],
          role: 'ADMIN',
          user_type: 'EDUCATOR',
          user_type_confirmed: true
        }
      })
      console.log('✓ Created user in database with ADMIN role')
    } else {
      // Update existing user
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: 'ADMIN',
          user_type: 'EDUCATOR',
          user_type_confirmed: true
        }
      })
      console.log('✓ Updated database user to ADMIN role')
    }
    
    console.log('\n✅ Success! User gurpeet@biji-biji.com now has ADMIN access.')
    console.log('📌 Please refresh the admin panel page: http://localhost:3001')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

makeAdmin()
