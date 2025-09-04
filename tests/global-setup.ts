/**
 * Global test setup
 * Runs once before all tests
 */

import { TestDatabase } from '../packages/db/tests/helpers'

let globalTestDb: TestDatabase | null = null

export async function setup() {
  console.log('🧪 Setting up global test environment...')
  
  try {
    // Initialize test database
    globalTestDb = new TestDatabase()
    await globalTestDb.setup()
    
    // Verify database connection
    const health = await globalTestDb.healthCheck()
    console.log(`📊 Database health check: ${health.connected ? '✅' : '❌'} (${health.latency}ms)`)
    console.log(`📋 Available tables: ${health.tables.join(', ')}`)
    
    console.log('✅ Global test setup completed successfully')
  } catch (error) {
    console.error('❌ Global test setup failed:', error)
    throw error
  }
}

export async function teardown() {
  console.log('🧹 Tearing down global test environment...')
  
  try {
    if (globalTestDb) {
      await globalTestDb.cleanup()
      console.log('✅ Global test teardown completed')
    }
  } catch (error) {
    console.error('❌ Global test teardown failed:', error)
  }
}