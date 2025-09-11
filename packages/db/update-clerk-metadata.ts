import fs from 'node:fs'
import path from 'node:path'

async function updateClerkMetadata() {
  const userId = 'user_328teXv7Od0N4I9ck6W7Q65SuaL'
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  
  if (!clerkSecretKey) {
    console.error('CLERK_SECRET_KEY not found in environment')
    console.log('Loading from .env.local...')
    
    // Try to load from env file
    const envPath = path.join(__dirname, '../../.env.local')
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      const match = envContent.match(/CLERK_SECRET_KEY=(.+)/)
      if (match) {
        process.env.CLERK_SECRET_KEY = match[1].trim()
      }
    }
  }
  
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    console.error('Still no CLERK_SECRET_KEY found')
    return
  }
  
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        public_metadata: {
          role: 'ADMIN',
          user_type: 'EDUCATOR'
        }
      })
    })
    
    if (response.ok) {
      await response.json().catch(() => undefined)
      console.log('✓ Successfully updated Clerk metadata to ADMIN')
      console.log('  User ID:', userId)
      console.log('  Role: ADMIN')
      console.log('  User Type: EDUCATOR')
      console.log('\n✅ Done! You should now have admin access.')
      console.log('🔄 Please refresh the admin panel: http://localhost:3001')
    } else {
      const error = await response.text()
      console.error('Failed to update Clerk metadata:', response.status, error)
    }
  } catch (error) {
    console.error('Error updating Clerk metadata:', error)
  }
}

void updateClerkMetadata()
