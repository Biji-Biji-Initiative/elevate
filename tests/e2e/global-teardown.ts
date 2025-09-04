/**
 * Global E2E test teardown
 * Runs once after all E2E tests
 */

async function globalTeardown() {
  console.log('🧹 Tearing down global E2E test environment...')
  
  try {
    // Cleanup is handled by individual test database instances
    console.log('✅ E2E global teardown completed')
  } catch (error) {
    console.error('❌ E2E global teardown failed:', error)
  }
}

export default globalTeardown