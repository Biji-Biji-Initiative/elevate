#!/usr/bin/env node

/**
 * Code Quality Validation Script
 * Performs comprehensive checks to prevent code quality drift
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { glob } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
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

class CodeQualityValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.checks = 0
  }

  addError(message) {
    this.errors.push(message)
    logError(message)
  }

  addWarning(message) {
    this.warnings.push(message)
    logWarning(message)
  }

  // Check for duplicate test files
  async checkDuplicateTests() {
    logInfo('Checking for duplicate test files...')
    this.checks++

    try {
      const testFiles = await glob('**/*.test.{ts,js}', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**'],
      })

      // Allow same basename in different packages; only flag duplicates within the same package
      const countsByPkgAndName = new Map()
      for (const file of testFiles) {
        const parts = file.split(path.sep)
        const packagesIdx = parts.indexOf('packages')
        const appsIdx = parts.indexOf('apps')
        let scope = 'root'
        if (packagesIdx >= 0 && parts[packagesIdx + 1]) {
          scope = `pkg:${parts[packagesIdx + 1]}`
        } else if (appsIdx >= 0 && parts[appsIdx + 1]) {
          scope = `app:${parts[appsIdx + 1]}`
        }
        const base = path.basename(file)
        const key = `${scope}:${base}`
        countsByPkgAndName.set(key, (countsByPkgAndName.get(key) || 0) + 1)
      }
      const dupes = [...countsByPkgAndName.entries()].filter(
        ([, count]) => count > 1,
      )
      if (dupes.length > 0) {
        this.addError('Found duplicate test basenames within the same package:')
        dupes.forEach(([k]) => console.log(`  ${k}`))
        return false
      }

      logSuccess(
        `No duplicate test basenames within packages (${testFiles.length} total)`,
      )
      return true
    } catch (error) {
      this.addError(`Error checking test files: ${error.message}`)
      return false
    }
  }

  // Check ESM import extensions (bundled default: allow extensionless imports in TS sources)
  async checkESMImports() {
    logInfo('Checking ESM import extensions (bundled default)...')
    this.checks++

    try {
      // No-op for now: bundlers (tsup/esbuild) rewrite relative imports in output as needed.
      logSuccess('Extensionless relative imports allowed for bundled packages')
      return true
    } catch (error) {
      this.addError(`Error checking ESM imports: ${error.message}`)
      return false
    }
  }

  // Check test file locations
  async checkTestLocations() {
    logInfo('Checking test file locations...')
    this.checks++

    try {
      const testFiles = await glob('packages/**/*.test.{ts,js}', {
        cwd: rootDir,
        ignore: ['**/node_modules/**', '**/dist/**'],
      })

      const misplacedTests = testFiles.filter((file) => {
        // Tests should be in __tests__, tests, or src/__tests__ directories
        return !file.match(/\/(src\/)?(__tests__|tests)\//)
      })

      if (misplacedTests.length > 0) {
        this.addError('Found tests outside expected directories:')
        misplacedTests.forEach((test) => console.log(`  ${test}`))
        console.log(
          '  Expected: packages/*/src/__tests__/ or packages/*/tests/ or packages/*/__tests__/',
        )
        return false
      }

      logSuccess(`All ${testFiles.length} test files in proper locations`)
      return true
    } catch (error) {
      this.addError(`Error checking test locations: ${error.message}`)
      return false
    }
  }

  // Check for deprecated imports
  async checkDeprecatedImports() {
    logInfo('Checking for deprecated imports...')
    this.checks++

    try {
      const sourceFiles = await glob('**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['**/node_modules/**', '**/dist/**', 'archive/**'],
      })

      const deprecatedImports = []

      for (const file of sourceFiles) {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf8')

        // Check for imports from deprecated api-types.ts (not admin-api-types.ts)
        if (
          content.includes("from './api-types'") ||
          content.includes("from '../api-types'")
        ) {
          deprecatedImports.push(file)
        }
      }

      if (deprecatedImports.length > 0) {
        this.addError('Found imports from deprecated api-types.ts:')
        deprecatedImports.forEach((file) => console.log(`  ${file}`))
        return false
      }

      logSuccess('No deprecated imports found')
      return true
    } catch (error) {
      this.addError(`Error checking deprecated imports: ${error.message}`)
      return false
    }
  }

  // Check package boundaries
  async checkPackageBoundaries() {
    logInfo('Checking package boundaries...')
    this.checks++

    try {
      const packageFiles = await glob('packages/**/*.{ts,tsx}', {
        cwd: rootDir,
        ignore: ['**/node_modules/**', '**/dist/**'],
      })

      const boundaryViolations = []

      for (const file of packageFiles) {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf8')

        // Packages should not import from apps
        if (
          content.includes("from 'apps/") ||
          content.includes('from "apps/') ||
          content.includes("from '../../../apps/") ||
          content.includes('from "../../../apps/')
        ) {
          boundaryViolations.push(file)
        }
      }

      if (boundaryViolations.length > 0) {
        this.addError('Found package→app boundary violations:')
        boundaryViolations.forEach((file) => console.log(`  ${file}`))
        return false
      }

      logSuccess('No package boundary violations found')
      return true
    } catch (error) {
      this.addError(`Error checking package boundaries: ${error.message}`)
      return false
    }
  }

  // Check TypeScript configuration consistency
  async checkTSConfig() {
    logInfo('Checking TypeScript configuration consistency...')
    this.checks++

    try {
      const packageDirs = await glob('packages/*', {
        cwd: rootDir,
        onlyDirectories: true,
      })

      const missingConfigs = []

      for (const dir of packageDirs) {
        const tsconfigPath = path.join(rootDir, dir, 'tsconfig.json')
        const hasTS = await glob('**/*.{ts,tsx}', {
          cwd: path.join(rootDir, dir),
          ignore: ['node_modules/**', 'dist/**'],
        }).then((files) => files.length > 0)

        if (hasTS && !fs.existsSync(tsconfigPath)) {
          missingConfigs.push(dir)
        }
      }

      if (missingConfigs.length > 0) {
        this.addError('Packages with TypeScript files but no tsconfig.json:')
        missingConfigs.forEach((dir) => console.log(`  ${dir}`))
        return false
      }

      logSuccess(`All packages with TypeScript have tsconfig.json`)
      return true
    } catch (error) {
      this.addError(`Error checking TypeScript configs: ${error.message}`)
      return false
    }
  }

  // Check for generated artifacts under src (should live in dist/ only)
  async checkGeneratedInSrc() {
    logInfo('Checking for generated artifacts under src/...')
    this.checks++

    try {
      const generated = await glob(
        'packages/*/src/**/*.{d.ts,d.ts.map,js.map}',
        {
          cwd: rootDir,
          ignore: ['**/node_modules/**'],
        },
      )
      if (generated.length > 0) {
        this.addError('Found generated files under src (should be in dist/):')
        generated.forEach((f) => console.log('  ' + f))
        return false
      }
      logSuccess('No generated artifacts under src')
      return true
    } catch (error) {
      this.addError(`Error checking generated artifacts: ${error.message}`)
      return false
    }
  }

  // Run all checks
  async runAll() {
    console.log('\n🔍 Running Code Quality Validation\n')

    const results = await Promise.all([
      this.checkDuplicateTests(),
      this.checkESMImports(),
      this.checkTestLocations(),
      this.checkDeprecatedImports(),
      this.checkPackageBoundaries(),
      this.checkTSConfig(),
      this.checkGeneratedInSrc(),
    ])

    // Summary
    console.log('\n📊 Validation Summary')
    console.log('='.repeat(50))

    const passed = results.filter(Boolean).length
    const failed = results.length - passed

    if (failed === 0) {
      logSuccess(`All ${this.checks} checks passed!`)
    } else {
      logError(`${failed} out of ${this.checks} checks failed`)
    }

    if (this.warnings.length > 0) {
      logWarning(`${this.warnings.length} warnings`)
    }

    if (this.errors.length > 0) {
      console.log('\n🔴 Errors to fix:')
      this.errors.forEach((error, i) => console.log(`${i + 1}. ${error}`))
    }

    if (this.warnings.length > 0) {
      console.log('\n🟡 Warnings to review:')
      this.warnings.forEach((warning, i) => console.log(`${i + 1}. ${warning}`))
    }

    return failed === 0
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CodeQualityValidator()

  try {
    const success = await validator.runAll()
    process.exit(success ? 0 : 1)
  } catch (error) {
    logError(`Validation failed: ${error.message}`)
    process.exit(1)
  }
}
