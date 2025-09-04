#!/usr/bin/env tsx
/**
 * Migration status checker for @elevate/db
 * 
 * This script helps verify migration status and provides
 * guidance for common migration scenarios.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

interface MigrationCheck {
  name: string
  description: string
  check: () => boolean | Promise<boolean>
  action?: string
}

const SCHEMA_PATH = resolve(__dirname, '../schema.prisma')
const MIGRATIONS_PATH = resolve(__dirname, '../migrations')

const checks: MigrationCheck[] = [
  {
    name: 'Schema file exists',
    description: 'Verifies schema.prisma is present',
    check: () => existsSync(SCHEMA_PATH),
    action: 'Create schema.prisma file'
  },
  {
    name: 'Migrations directory exists',
    description: 'Verifies migrations/ directory is present',
    check: () => existsSync(MIGRATIONS_PATH),
    action: 'Run pnpm db:migrate:dev to create first migration'
  },
  {
    name: 'Prisma client generated',
    description: 'Checks if @prisma/client is up to date',
    check: () => {
      try {
        execSync('prisma generate --schema=./schema.prisma', { cwd: __dirname + '/..', stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    },
    action: 'Run pnpm db:generate'
  },
  {
    name: 'Migration status',
    description: 'Checks pending migrations',
    check: async () => {
      try {
        const result = execSync('prisma migrate status --schema=./schema.prisma', { 
          cwd: __dirname + '/..',
          encoding: 'utf8',
          stdio: 'pipe'
        })
        return !result.includes('following migration have not yet been applied')
      } catch (error) {
        console.warn('Could not check migration status:', (error as Error).message)
        return false
      }
    },
    action: 'Run pnpm db:migrate or pnpm db:migrate:dev'
  }
]

async function runChecks() {
  console.log('🔍 Checking @elevate/db migration status...\n')

  let allPassed = true

  for (const check of checks) {
    process.stdout.write(`${check.name}... `)
    
    try {
      const result = await check.check()
      
      if (result) {
        console.log('✅ PASS')
      } else {
        console.log('❌ FAIL')
        if (check.action) {
          console.log(`   Action: ${check.action}`)
        }
        allPassed = false
      }
    } catch (error) {
      console.log('⚠️  ERROR')
      console.log(`   ${(error as Error).message}`)
      allPassed = false
    }
  }

  console.log()

  if (allPassed) {
    console.log('🎉 All migration checks passed!')
    console.log('\n✨ Database is ready for development')
  } else {
    console.log('⚠️  Some checks failed. Please review the actions above.')
    console.log('\n📚 For more help, see: packages/db/MIGRATIONS.md')
    process.exit(1)
  }
}

// Migration recommendations based on environment
function printRecommendations() {
  const env = process.env.NODE_ENV || 'development'
  
  console.log(`\n💡 Recommendations for ${env}:`)
  
  if (env === 'development') {
    console.log('  • Use pnpm db:migrate:dev for schema changes')
    console.log('  • Run pnpm db:reset to start fresh')
    console.log('  • Use pnpm db:studio to explore data')
  } else if (env === 'production') {
    console.log('  • Use pnpm db:migrate for safe deployment')
    console.log('  • Always backup before migrations')
    console.log('  • Monitor materialized view refresh: SELECT refresh_leaderboards();')
  } else {
    console.log('  • Use pnpm db:migrate:status to check state')
    console.log('  • Test migrations thoroughly in staging')
  }
}

if (require.main === module) {
  runChecks()
    .then(() => printRecommendations())
    .catch(console.error)
}