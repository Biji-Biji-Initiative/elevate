/**
 * Global test setup
 * Runs once before all tests
 */

let globalTestDb: any | null = null

function shouldSkipDb(): boolean {
  const flag = String(process.env.SKIP_DB_TESTS || '').toLowerCase()
  const skipFlag = flag === '1' || flag === 'true'
  const hasDbUrl = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
  return skipFlag || !hasDbUrl
}

export async function setup() {
  console.log('🧪 Setting up global test environment...')

  if (shouldSkipDb()) {
    console.log('⏭️  SKIP_DB_TESTS enabled or no DB URL; skipping DB setup')
    return
  }

  try {
    const { TestDatabase } = await import('../packages/db/tests/helpers')
    globalTestDb = new TestDatabase()
    await globalTestDb.setup()

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

  if (shouldSkipDb()) {
    console.log('⏭️  SKIP_DB_TESTS enabled or no DB URL; skipping DB teardown')
    return
  }

  try {
    if (globalTestDb) {
      await globalTestDb.cleanup()
      console.log('✅ Global test teardown completed')
    }
  } catch (error) {
    console.error('❌ Global test teardown failed:', error)
  }
}
