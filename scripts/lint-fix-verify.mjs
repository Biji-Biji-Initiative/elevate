#!/usr/bin/env node
/**
 * Post-lint-fix verification script
 * Ensures that ESLint fixes didn't introduce new issues or regressions
 * Per BUILDING.md Section 11 & 12 - Drift Prevention
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
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
  magenta: '\x1b[35m'
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

/**
 * Run a command and capture output
 */
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
    return { success: true, output: result }
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.output,
      code: error.status 
    }
  }
}

/**
 * Check that TypeScript compilation still works
 */
async function verifyTypeScript() {
  logStep('Verifying TypeScript compilation...')
  
  const result = runCommand('pnpm run typecheck:build', { silent: true })
  
  if (!result.success) {
    logError('TypeScript compilation failed after lint fixes!')
    console.log('\nTypeScript errors:')
    console.log(result.output || result.error)
    return false
  }
  
  logSuccess('TypeScript compilation successful')
  return true
}

/**
 * Check that ESLint passes without errors
 */
async function verifyESLint() {
  logStep('Verifying ESLint passes without errors...')
  
  const result = runCommand('pnpm run lint', { silent: true })
  
  if (!result.success) {
    logError('ESLint still reports errors after fixes!')
    
    // Try to show just the error summary
    const output = result.output || result.error || ''
    const lines = output.split('\n')
    const errorLines = lines.filter(line => 
      line.includes('error') || 
      line.includes('✖') ||
      line.includes('problems')
    )
    
    if (errorLines.length > 0) {
      console.log('\nRemaining ESLint issues:')
      errorLines.forEach(line => console.log(line))
    } else {
      console.log('\nFull ESLint output:')
      console.log(output)
    }
    return false
  }
  
  logSuccess('ESLint passes without errors')
  return true
}

/**
 * Check that imports are still valid
 */
async function verifyImports() {
  logStep('Verifying import paths...')
  
  // Run our import validation script
  const result = runCommand('node scripts/validate-imports.mjs', { silent: true })
  
  if (!result.success) {
    logError('Import validation failed after lint fixes!')
    console.log('\nImport validation output:')
    console.log(result.output || result.error)
    return false
  }
  
  logSuccess('Import paths are valid')
  return true
}

/**
 * Check that exports are still aligned
 */
async function verifyExports() {
  logStep('Verifying export/entry alignment...')
  
  const result = runCommand('node scripts/validate-exports.mjs', { silent: true })
  
  if (!result.success) {
    logError('Export validation failed after lint fixes!')
    console.log('\nExport validation output:')
    console.log(result.output || result.error)
    return false
  }
  
  logSuccess('Exports and entries are aligned')
  return true
}

/**
 * Check that builds still work
 */
async function verifyBuilds() {
  logStep('Verifying package builds...')
  
  // Test that types build
  const typesResult = runCommand('pnpm run build:types', { silent: true })
  
  if (!typesResult.success) {
    logError('Type builds failed after lint fixes!')
    console.log('\nType build output:')
    console.log(typesResult.output || typesResult.error)
    return false
  }
  
  logSuccess('Package builds successful')
  return true
}

/**
 * Check for common post-fix issues
 */
async function checkCommonIssues() {
  logStep('Checking for common post-fix issues...')
  
  let hasIssues = false
  
  // Check for accidentally removed exports
  try {
    const packageJsonFiles = await new Promise((resolve, reject) => {
      const { glob } = require('glob')
      glob('packages/*/package.json', { cwd: rootDir }, (err, files) => {
        if (err) reject(err)
        else resolve(files)
      })
    })
    
    for (const pkgFile of packageJsonFiles) {
      const pkgPath = join(rootDir, pkgFile)
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      
      if (!pkg.exports && pkg.name.startsWith('@elevate/')) {
        logWarning(`Package ${pkg.name} has no exports field`)
        hasIssues = true
      }
    }
    
  } catch (error) {
    logWarning(`Could not check package exports: ${error.message}`)
  }
  
  if (!hasIssues) {
    logSuccess('No common post-fix issues detected')
  }
  
  return !hasIssues
}

/**
 * Main verification function
 */
async function main() {
  console.log('\n🔍 Post-Lint-Fix Verification')
  console.log('='.repeat(50))
  console.log()
  
  const checks = [
    { name: 'TypeScript Compilation', fn: verifyTypeScript },
    { name: 'ESLint Validation', fn: verifyESLint },
    { name: 'Import Validation', fn: verifyImports },
    { name: 'Export Validation', fn: verifyExports },
    { name: 'Package Builds', fn: verifyBuilds },
    { name: 'Common Issues Check', fn: checkCommonIssues }
  ]
  
  const results = []
  let allPassed = true
  
  for (const check of checks) {
    try {
      const result = await check.fn()
      results.push({ name: check.name, success: result })
      if (!result) {
        allPassed = false
      }
    } catch (error) {
      logError(`${check.name} failed with exception: ${error.message}`)
      results.push({ name: check.name, success: false, error: error.message })
      allPassed = false
    }
    console.log() // Add spacing between checks
  }
  
  // Summary
  console.log('='.repeat(50))
  console.log('Verification Summary')
  console.log('='.repeat(50))
  
  results.forEach(result => {
    if (result.success) {
      logSuccess(`${result.name}`)
    } else {
      logError(`${result.name}`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }
    }
  })
  
  console.log()
  
  if (allPassed) {
    logSuccess('All verification checks passed!')
    console.log('✓ TypeScript compiles successfully')
    console.log('✓ ESLint passes without errors')
    console.log('✓ Import paths are valid')
    console.log('✓ Exports are properly aligned')
    console.log('✓ Packages build successfully')
    console.log('\nLint fixes were applied successfully without regressions.')
    process.exit(0)
  } else {
    const failedCount = results.filter(r => !r.success).length
    logError(`${failedCount} out of ${results.length} verification checks failed!`)
    console.log('\nPlease review and fix the issues above before proceeding.')
    console.log('The lint fixes may have introduced regressions that need manual attention.')
    process.exit(1)
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logError(`Verification script failed: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  })
}