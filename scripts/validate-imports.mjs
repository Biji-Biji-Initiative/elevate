#!/usr/bin/env node
/**
 * Validates import paths and blocks deep internal imports
 * Per BUILDING.md Section 12 - Path Resolution and Imports
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

import { glob } from 'glob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

let hasErrors = false

/**
 * Colors for output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
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

function logInfo(message) {
  log('blue', 'ℹ️ ', message)
}

/**
 * Check for forbidden import patterns
 */
function checkImportPatterns(filePath, content) {
  const violations = []
  const lines = content.split('\n')
  
  lines.forEach((line, index) => {
    const lineNum = index + 1
    
    // Check for deep internal imports (src/ paths)
    if (line.match(/import.*from\s+['""]@elevate\/[^'"]*\/src/)) {
      violations.push({
        type: 'deep-internal',
        line: lineNum,
        content: line.trim(),
        message: 'Import from internal src/ path is forbidden. Use published package subpaths.'
      })
    }
    
    // Check for dist/ imports
    if (line.match(/import.*from\s+['""]@elevate\/[^'"]*\/dist/)) {
      violations.push({
        type: 'dist-import',
        line: lineNum,
        content: line.trim(),
        message: 'Import from dist/ path is forbidden. Use published package subpaths.'
      })
    }
    
    // Check for relative imports to other packages' internals
    if (line.match(/import.*from\s+['""]\.\.\/\.\.\/[^'"]*\/src/)) {
      violations.push({
        type: 'cross-package-src',
        line: lineNum,
        content: line.trim(),
        message: 'Cross-package src/ import is forbidden. Use published package subpaths.'
      })
    }
    
    // Check for improper relative imports in packages (should be workspace imports)
    const relativePackageImport = line.match(/import.*from\s+['""]\.\.\/\.\.\/\.\.\/packages\/([^'"]*)['""]/);
    if (relativePackageImport) {
      const targetPackage = relativePackageImport[1];
      violations.push({
        type: 'relative-package',
        line: lineNum,
        content: line.trim(),
        message: `Relative package import is discouraged. Use '@elevate/${targetPackage}' instead.`
      })
    }
  })
  
  return violations
}

/**
 * Validate imports in a single file
 */
function validateFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const violations = checkImportPatterns(filePath, content)
    
    if (violations.length > 0) {
      hasErrors = true
      const relativePath = relative(rootDir, filePath)
      logError(`Found import violations in ${relativePath}:`)
      
      violations.forEach(violation => {
        console.log(`  Line ${violation.line}: ${colors.yellow}${violation.message}${colors.reset}`)
        console.log(`    ${violation.content}`)
      })
      
      return false
    }
    
    return true
  } catch (error) {
    hasErrors = true
    logError(`Failed to validate ${filePath}: ${error.message}`)
    return false
  }
}

/**
 * Check if a directory is a package directory
 */
function isPackageDirectory(dirPath) {
  return existsSync(join(dirPath, 'package.json'))
}

/**
 * Main validation function
 */
async function main() {
  logInfo('Validating import paths and boundaries...\n')
  
  // Find all TypeScript files in packages and apps
  const sourceFiles = await glob('**/*.{ts,tsx}', {
    cwd: rootDir,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/archive/**',
      // Config files that may have looser import rules
      '**/tsup.config.ts',
      '**/next.config.ts',
      '**/tailwind.config.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      '**/eslint.config.mjs'
    ]
  })
  
  if (sourceFiles.length === 0) {
    logError('No TypeScript files found to validate')
    process.exit(1)
  }
  
  logInfo(`Checking ${sourceFiles.length} TypeScript files...`)
  
  let validFiles = 0
  let totalFiles = 0
  
  // Validate each file
  for (const filePath of sourceFiles) {
    totalFiles++
    if (validateFile(filePath)) {
      validFiles++
    }
  }
  
  // Summary
  console.log()
  console.log('='.repeat(60))
  console.log('Import Validation Summary')
  console.log('='.repeat(60))
  
  if (hasErrors) {
    logError(`${totalFiles - validFiles} files with import violations out of ${totalFiles} total`)
    console.log()
    console.log('Common fixes:')
    console.log('• Replace @elevate/package/src/... with @elevate/package or @elevate/package/subpath')
    console.log('• Replace @elevate/package/dist/... with @elevate/package or @elevate/package/subpath')
    console.log('• Replace relative package imports with workspace imports (@elevate/...)')
    console.log('• Ensure all imports use published package.json exports only')
    process.exit(1)
  } else {
    logSuccess(`All ${totalFiles} files have valid import paths!`)
    console.log('✓ No deep internal imports found')
    console.log('✓ No dist/ imports found') 
    console.log('✓ All imports use published package subpaths')
    process.exit(0)
  }
}

main().catch(err => {
  logError(`Validation failed: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
})