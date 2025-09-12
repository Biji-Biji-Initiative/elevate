#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * Validates that required environment variables are set for production deployments.
 * Used in CI/CD pipeline to catch missing configuration before deployment.
 * 
 * Usage:
 *   pnpm run env:validate:prod
 *   pnpm run env:validate:dev
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ENV_CONFIGS = {
  production: {
    required: [
      // Database
      'DATABASE_URL',
      'DIRECT_URL',
      
      // Clerk Auth
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
      'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
      'CLERK_WEBHOOK_SECRET',
      
      // Supabase (new naming)
      'SUPABASE_URL',
      'SUPABASE_PUBLIC_KEY',
      'SUPABASE_SECRET_KEY',
      
      // Kajabi
      'KAJABI_WEBHOOK_SECRET',
      'KAJABI_API_KEY',
      'KAJABI_CLIENT_SECRET',
      'KAJABI_SITE',
      'KAJABI_OFFER_ID',
      'KAJABI_OFFER_NAME',
      
      // App URLs
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_PUBLIC_APP_URL',
    ],
    optional: [
      // Kajabi optional
      'KAJABI_BASE_URL',
      
      // Observability
      'SENTRY_DSN',
      'SENTRY_AUTH_TOKEN',
      'TURBO_REMOTE_CACHE_SIGNATURE_KEY',
      
      // Cron
      'CRON_SECRET',
      
      // Admin bypass (dev only)
      'ADMIN_DEV_BYPASS_USER_IDS',
    ]
  },
  development: {
    required: [
      'DATABASE_URL',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'SUPABASE_URL',
      'SUPABASE_PUBLIC_KEY',
    ],
    optional: [
      'DIRECT_URL',
      'SUPABASE_SECRET_KEY',
      'KAJABI_WEBHOOK_SECRET',
      'KAJABI_API_KEY',
      'NEXT_PUBLIC_SITE_URL',
      'ADMIN_DEV_BYPASS_USER_IDS',
    ]
  }
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {}
  }
  
  const content = readFileSync(filePath, 'utf-8')
  const env = {}
  
  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) return
    
    const [key, ...valueParts] = line.split('=')
    if (key) {
      // Handle values with = in them
      const value = valueParts.join('=')
      // Remove quotes if present
      env[key.trim()] = value ? value.trim().replace(/^["']|["']$/g, '') : ''
    }
  })
  
  return env
}

function normalizeEnvVars(env) { return { ...env } }

function validateEnvironment(mode = 'production') {
  console.log(`\n🔍 Validating ${mode} environment variables...\n`)
  
  const config = ENV_CONFIGS[mode] || ENV_CONFIGS.production
  const rootDir = process.cwd()
  
  // Load env files in order of precedence
  const envFiles = [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`,
  ]
  
  let combinedEnv = { ...process.env }
  
  // Load env files (later files override earlier ones)
  envFiles.forEach(file => {
    const filePath = resolve(rootDir, file)
    const fileEnv = loadEnvFile(filePath)
    if (Object.keys(fileEnv).length > 0) {
      console.log(`  📄 Loaded: ${file}`)
      combinedEnv = { ...combinedEnv, ...fileEnv }
    }
  })
  
  // Normalize environment variables (map new names to legacy)
  combinedEnv = normalizeEnvVars(combinedEnv)
  
  console.log('\n')
  
  // Check required variables
  const missingRequired = []
  const presentRequired = []
  
  config.required.forEach(varName => {
    if (!combinedEnv[varName] || combinedEnv[varName].trim() === '') {
      missingRequired.push(varName)
    } else {
      presentRequired.push(varName)
    }
  })
  
  // Check optional variables
  const missingOptional = []
  const presentOptional = []
  
  config.optional.forEach(varName => {
    if (!combinedEnv[varName] || combinedEnv[varName].trim() === '') {
      missingOptional.push(varName)
    } else {
      presentOptional.push(varName)
    }
  })
  
  // Report results
  if (presentRequired.length > 0) {
    console.log('✅ Required variables present:')
    presentRequired.forEach(v => console.log(`   • ${v}`))
    console.log('')
  }
  
  if (presentOptional.length > 0) {
    console.log('ℹ️  Optional variables present:')
    presentOptional.forEach(v => console.log(`   • ${v}`))
    console.log('')
  }
  
  if (missingOptional.length > 0) {
    console.log('⚠️  Optional variables missing (may affect some features):')
    missingOptional.forEach(v => console.log(`   • ${v}`))
    console.log('')
  }
  
  if (missingRequired.length > 0) {
    console.error('❌ Required variables missing:')
    missingRequired.forEach(v => console.error(`   • ${v}`))
    console.log('')
    console.error(`❌ Validation failed! Missing ${missingRequired.length} required environment variable(s).`)
    
    if (mode === 'production') {
      console.error('\n⚠️  These variables MUST be set in your Vercel project settings before deployment.')
    }
    
    process.exit(1)
  } else {
    console.log(`✅ All required ${mode} environment variables are present!\n`)
  }
  
  // Summary
  console.log('📊 Summary:')
  console.log(`   Required: ${presentRequired.length}/${config.required.length}`)
  console.log(`   Optional: ${presentOptional.length}/${config.optional.length}`)
  console.log('')
}

// Parse command line arguments
const args = process.argv.slice(2)
const mode = args[0] || 'production'

if (!ENV_CONFIGS[mode]) {
  console.error(`❌ Unknown mode: ${mode}`)
  console.error('   Valid modes: production, development')
  process.exit(1)
}

validateEnvironment(mode)
