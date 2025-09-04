#!/usr/bin/env node
/**
 * Comprehensive Validation Pipeline
 * Runs all validation checks in sequence with proper error reporting
 * Per BUILDING.md Phase 4 requirements
 */

import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

/**
 * Colors for output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`)
}

function logError(message) {
  log('red', '❌', message)
}

function logSuccess(message) {
  log('green', '✅', message)
}

function logWarning(message) {
  log('yellow', '⚠️ ', message)
}

function logInfo(message) {
  log('blue', 'ℹ️ ', message)
}

function logStep(message) {
  log('magenta', '🔄', message)
}

function logHeader(message) {
  console.log(`\n${colors.cyan}${colors.bold}${message}${colors.reset}`)
  console.log('='.repeat(message.length))
}

/**
 * Run a command and capture output
 */
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      ...options
    })
    return { success: true, output: result }
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.output || error.stderr,
      code: error.status 
    }
  }
}

/**
 * Validation checks
 */
const validationChecks = [
  {
    name: 'TypeScript Compilation',
    description: 'Check that all TypeScript compiles without errors',
    command: 'pnpm run typecheck:build',
    critical: true
  },
  {
    name: 'Import Path Validation',
    description: 'Check for deep internal imports and boundary violations',
    command: 'node scripts/validate-imports.mjs',
    critical: true
  },
  {
    name: 'Export/Entry Alignment',
    description: 'Validate tsup entries match package.json exports',
    command: 'node scripts/validate-exports.mjs',
    critical: true
  },
  {
    name: 'ESLint Package Check',
    description: 'Run ESLint on all packages with strict rules',
    command: 'pnpm run lint:packages',
    critical: true
  },
  {
    name: 'Code Quality Checks',
    description: 'Run comprehensive code quality validation',
    command: 'node scripts/validate-code-quality.mjs',
    critical: false
  },
  {
    name: 'API Report Generation',
    description: 'Generate API reports for all packages',
    command: 'pnpm run api:extract',
    critical: false
  },
  {
    name: 'Build Types Check',
    description: 'Verify all packages can build type declarations',
    command: 'pnpm run build:types',
    critical: true
  }
]

/**
 * Main validation function
 */
async function main() {
  logHeader('🔍 Comprehensive Validation Pipeline')
  console.log('Running all validation checks per BUILDING.md Phase 4 requirements')
  console.log()

  const results = []
  let criticalFailures = 0
  let totalFailures = 0

  for (const check of validationChecks) {
    logStep(`${check.name}...`)
    console.log(`   ${check.description}`)
    
    const startTime = Date.now()
    const result = runCommand(check.command, { silent: true })
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    if (result.success) {
      logSuccess(`${check.name} passed (${duration}s)`)
    } else {
      const level = check.critical ? 'CRITICAL' : 'WARNING'
      logError(`${check.name} failed (${duration}s) - ${level}`)
      
      // Show relevant error output
      if (result.output) {
        const lines = result.output.split('\n')
        const relevantLines = lines
          .filter(line => 
            line.includes('error') || 
            line.includes('✗') || 
            line.includes('❌') ||
            line.includes('Failed') ||
            line.includes('ELIFECYCLE')
          )
          .slice(0, 10) // Limit to first 10 error lines
        
        if (relevantLines.length > 0) {
          console.log('   Key errors:')
          relevantLines.forEach(line => console.log(`   ${line.trim()}`))
        }
      }
      
      if (check.critical) {
        criticalFailures++
      }
      totalFailures++
    }
    
    results.push({
      name: check.name,
      success: result.success,
      critical: check.critical,
      duration: duration,
      output: result.output
    })
    
    console.log() // Add spacing between checks
  }

  // Summary
  logHeader('📊 Validation Summary')
  
  const passed = results.filter(r => r.success).length
  const failed = results.length - passed
  
  console.log(`Total checks: ${results.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Critical failures: ${criticalFailures}`)
  console.log()
  
  // Detailed results
  results.forEach(result => {
    const icon = result.success ? '✅' : (result.critical ? '❌' : '⚠️')
    const level = result.critical ? 'CRITICAL' : 'OPTIONAL'
    console.log(`${icon} ${result.name} (${result.duration}s) ${!result.critical ? `[${level}]` : ''}`)
  })
  
  console.log()
  
  // Recommendations
  if (criticalFailures > 0) {
    logError('CRITICAL FAILURES DETECTED!')
    console.log()
    console.log('Critical issues must be resolved before deployment:')
    
    results
      .filter(r => !r.success && r.critical)
      .forEach(result => {
        console.log(`• Fix ${result.name}`)
      })
    
    console.log()
    console.log('Use these commands to debug individual issues:')
    console.log('• pnpm run typecheck:build - Fix TypeScript errors')
    console.log('• node scripts/validate-imports.mjs - Fix import violations')
    console.log('• node scripts/validate-exports.mjs - Fix export/entry mismatches')
    console.log('• pnpm run lint:packages - Fix ESLint violations')
    
    process.exit(1)
  } else if (totalFailures > 0) {
    logWarning(`${totalFailures} non-critical issues found`)
    console.log('Consider addressing these issues for better code quality.')
    process.exit(0)
  } else {
    logSuccess('All validation checks passed!')
    console.log()
    console.log('✓ TypeScript compiles without errors')
    console.log('✓ Import paths follow monorepo boundaries')
    console.log('✓ Package exports are properly aligned')
    console.log('✓ Code meets quality standards')
    console.log('✓ API surfaces are documented')
    console.log('✓ Build pipeline is healthy')
    console.log()
    console.log('🚀 Ready for deployment!')
    process.exit(0)
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logError(`Validation pipeline failed: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  })
}