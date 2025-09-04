/**
 * Global E2E test setup
 * Runs once before all E2E tests
 */

import { TestDatabase } from '../../packages/db/tests/helpers'

let globalTestDb: TestDatabase | null = null

async function globalSetup() {
  console.log('🧪 Setting up global E2E test environment...')
  
  try {
    // Initialize test database
    globalTestDb = new TestDatabase()
    await globalTestDb.setup()
    
    // Create test scenario with comprehensive data
    await globalTestDb.fixtures.createTestScenario('comprehensive')
    
    console.log('✅ E2E global setup completed successfully')
  } catch (error) {
    console.error('❌ E2E global setup failed:', error)
    throw error
  }
}

export default globalSetup