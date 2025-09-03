#!/usr/bin/env node
/**
 * Validates that tsup entries match package.json exports
 * Per BUILDING.md Section 10 - Drift Prevention
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

let hasErrors = false

/**
 * Parse tsup config to extract entry points
 */
function getTsupEntries(packagePath) {
  const tsupConfigPath = join(packagePath, 'tsup.config.ts')
  if (!existsSync(tsupConfigPath)) {
    return []
  }
  
  const content = readFileSync(tsupConfigPath, 'utf-8')
  
  // Extract entry array from tsup config
  const entryMatch = content.match(/entry:\s*\[(.*?)\]/s)
  if (!entryMatch) return []
  
  // Parse entries
  const entries = entryMatch[1]
    .split(',')
    .map(e => e.trim())
    .filter(e => e)
    .map(e => e.replace(/['"`]/g, ''))
    .map(e => e.replace('src/', '').replace('.tsx', '').replace('.ts', ''))
  
  return entries
}

/**
 * Parse package.json exports
 */
function getPackageExports(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return []
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  if (!packageJson.exports) {
    return []
  }
  
  const exports = []
  
  // Handle different export formats
  for (const [key, value] of Object.entries(packageJson.exports)) {
    // Skip package.json export
    if (key === './package.json') continue
    
    // Extract export name
    let exportName = key === '.' ? 'index' : key.replace('./', '')
    
    // Check if this export points to JS files (not just types)
    if (typeof value === 'object' && (value.default || value.import)) {
      exports.push(exportName)
    } else if (typeof value === 'string' && value.includes('/js/')) {
      exports.push(exportName)
    }
  }
  
  return exports
}

/**
 * Validate a single package
 */
function validatePackage(packagePath) {
  const packageName = JSON.parse(
    readFileSync(join(packagePath, 'package.json'), 'utf-8')
  ).name
  
  const tsupEntries = getTsupEntries(packagePath)
  const packageExports = getPackageExports(packagePath)
  
  // Skip packages without tsup (types-only packages)
  if (tsupEntries.length === 0 && !existsSync(join(packagePath, 'tsup.config.ts'))) {
    console.log(`✓ ${packageName} (types-only package)`)
    return
  }
  
  // Compare entries and exports
  const entriesSet = new Set(tsupEntries)
  const exportsSet = new Set(packageExports)
  
  const missingInExports = tsupEntries.filter(e => !exportsSet.has(e))
  const missingInEntries = packageExports.filter(e => !entriesSet.has(e))
  
  if (missingInExports.length > 0 || missingInEntries.length > 0) {
    hasErrors = true
    console.error(`✗ ${packageName}`)
    
    if (missingInExports.length > 0) {
      console.error(`  Missing in package.json exports:`)
      missingInExports.forEach(e => console.error(`    - ${e}`))
    }
    
    if (missingInEntries.length > 0) {
      console.error(`  Missing in tsup entries:`)
      missingInEntries.forEach(e => console.error(`    - ${e}`))
    }
  } else {
    console.log(`✓ ${packageName}`)
  }
}

/**
 * Main validation
 */
async function main() {
  console.log('Validating export-entry alignment...\n')
  
  // Find all packages
  const packages = await glob('packages/*', {
    cwd: rootDir,
    absolute: true,
    onlyDirectories: true,
  })
  
  // Validate each package
  for (const packagePath of packages) {
    validatePackage(packagePath)
  }
  
  console.log()
  
  if (hasErrors) {
    console.error('❌ Export validation failed!')
    console.error('Fix mismatches between tsup entries and package.json exports.')
    process.exit(1)
  } else {
    console.log('✅ All exports validated successfully!')
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})