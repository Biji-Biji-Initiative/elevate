#!/usr/bin/env node

/**
 * Build Artifact Policy Enforcement Script
 * 
 * This script ensures that:
 * 1. No stale build artifacts exist in packages/*/dist/
 * 2. All TypeScript compilation is successful before JS artifacts are generated
 * 3. Build artifacts are properly cleaned between builds
 * 4. Hash verification ensures source and compiled artifacts match
 */

import { execSync } from 'child_process'
import { existsSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { createHash } from 'crypto'
import { glob } from 'glob'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

class BuildArtifactPolicyEnforcer {
  constructor() {
    this.errors = []
    this.warnings = []
    this.packagePaths = glob.sync('packages/*/package.json', { cwd: rootDir })
      .map(p => dirname(join(rootDir, p)))
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'
    console.log(`[${timestamp}] ${prefix} ${message}`)
  }

  error(message) {
    this.log(message, 'error')
    this.errors.push(message)
  }

  warn(message) {
    this.log(message, 'warning')
    this.warnings.push(message)
  }

  /**
   * Calculate hash of source files in a package
   */
  calculateSourceHash(packagePath) {
    try {
      const srcPattern = join(packagePath, 'src/**/*.{ts,tsx,js,jsx}')
      const sourceFiles = glob.sync(srcPattern)
      
      if (sourceFiles.length === 0) {
        return null
      }

      const hash = createHash('sha256')
      
      // Sort files for consistent hashing
      sourceFiles.sort().forEach(file => {
        const content = readFileSync(file, 'utf-8')
        hash.update(`${file}:${content}`)
      })

      return hash.digest('hex')
    } catch (err) {
      this.warn(`Failed to calculate source hash for ${packagePath}: ${err.message}`)
      return null
    }
  }

  /**
   * Remove all build artifacts from packages
   */
  cleanAllArtifacts() {
    this.log('Cleaning all build artifacts...')
    
    for (const packagePath of this.packagePaths) {
      const distPath = join(packagePath, 'dist')
      const tsBuildInfoPath = join(packagePath, 'dist/.tsbuildinfo')
      
      if (existsSync(distPath)) {
        rmSync(distPath, { recursive: true, force: true })
        this.log(`Cleaned: ${distPath}`)
      }
    }
  }

  /**
   * Check if dist directories are properly ignored by git
   */
  checkGitIgnore() {
    this.log('Checking git ignore patterns...')
    
    try {
      const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf-8')
      
      if (!gitignore.includes('dist/')) {
        this.error('dist/ is not properly ignored in .gitignore')
      }

      if (!gitignore.includes('*.tsbuildinfo')) {
        this.error('*.tsbuildinfo is not properly ignored in .gitignore')
      }

      // Check if any dist files are tracked in git
      try {
        const trackedDistFiles = execSync('git ls-files | grep -E "^packages/.*/dist/"', { 
          cwd: rootDir, 
          encoding: 'utf-8',
          stdio: 'pipe'
        }).trim()

        if (trackedDistFiles) {
          this.error(`Found tracked dist files in git:\n${trackedDistFiles}`)
        }
      } catch (err) {
        // No tracked dist files found - this is good
      }

    } catch (err) {
      this.error(`Failed to check .gitignore: ${err.message}`)
    }
  }

  /**
   * Verify that all tsup configs have clean: true
   */
  checkTsupConfigs() {
    this.log('Checking tsup configurations...')

    for (const packagePath of this.packagePaths) {
      const tsupConfigPath = join(packagePath, 'tsup.config.ts')
      
      if (existsSync(tsupConfigPath)) {
        const config = readFileSync(tsupConfigPath, 'utf-8')
        
        if (!config.includes('clean: true')) {
          this.error(`${tsupConfigPath} should have 'clean: true' to prevent stale artifacts`)
        }
      }
    }
  }

  /**
   * Run TypeScript compilation check across all packages
   */
  checkTypeScript() {
    this.log('Running TypeScript compilation check...')
    
    try {
      execSync('pnpm run typecheck:build', { 
        cwd: rootDir,
        stdio: 'inherit'
      })
      this.log('✅ TypeScript compilation successful')
    } catch (err) {
      this.error('TypeScript compilation failed')
      throw err
    }
  }

  /**
   * Save build hashes for verification
   */
  saveBuildHashes() {
    this.log('Saving build hashes...')
    
    const hashes = {}
    
    for (const packagePath of this.packagePaths) {
      const packageName = JSON.parse(readFileSync(join(packagePath, 'package.json'))).name
      const sourceHash = this.calculateSourceHash(packagePath)
      
      if (sourceHash) {
        hashes[packageName] = {
          sourceHash,
          buildTime: new Date().toISOString()
        }
      }
    }

    writeFileSync(
      join(rootDir, '.build-hashes.json'), 
      JSON.stringify(hashes, null, 2)
    )
  }

  /**
   * Verify build hashes match source
   */
  verifyBuildHashes() {
    this.log('Verifying build hashes...')
    
    const hashFile = join(rootDir, '.build-hashes.json')
    if (!existsSync(hashFile)) {
      this.warn('No build hashes file found - skipping verification')
      return
    }

    const savedHashes = JSON.parse(readFileSync(hashFile, 'utf-8'))
    
    for (const packagePath of this.packagePaths) {
      const packageName = JSON.parse(readFileSync(join(packagePath, 'package.json'))).name
      const currentSourceHash = this.calculateSourceHash(packagePath)
      
      if (currentSourceHash && savedHashes[packageName]) {
        if (savedHashes[packageName].sourceHash !== currentSourceHash) {
          this.error(`Source code changed but build artifacts may be stale for ${packageName}`)
        }
      }
    }
  }

  /**
   * Run complete policy enforcement
   */
  async enforce(options = {}) {
    this.log('🚀 Starting build artifact policy enforcement')
    
    try {
      // Step 1: Check git configuration
      this.checkGitIgnore()
      
      // Step 2: Check tsup configurations
      this.checkTsupConfigs()

      if (options.clean) {
        // Step 3: Clean all artifacts
        this.cleanAllArtifacts()
      }

      if (options.verify) {
        // Step 4: Verify hashes if requested
        this.verifyBuildHashes()
      }

      // Step 5: Run TypeScript check
      this.checkTypeScript()

      if (options.build) {
        // Step 6: Build all packages
        this.log('Building all packages...')
        execSync('pnpm run build', { 
          cwd: rootDir,
          stdio: 'inherit'
        })
        
        // Step 7: Save new hashes
        this.saveBuildHashes()
      }

      // Report results
      if (this.errors.length > 0) {
        this.log(`❌ Policy enforcement failed with ${this.errors.length} error(s):`)
        this.errors.forEach(err => this.log(`  - ${err}`, 'error'))
        process.exit(1)
      }

      if (this.warnings.length > 0) {
        this.log(`⚠️ Policy enforcement completed with ${this.warnings.length} warning(s):`)
        this.warnings.forEach(warn => this.log(`  - ${warn}`, 'warning'))
      }

      this.log('✅ Build artifact policy enforcement completed successfully')
      
    } catch (err) {
      this.error(`Policy enforcement failed: ${err.message}`)
      process.exit(1)
    }
  }
}

// CLI interface
const args = process.argv.slice(2)
const options = {
  clean: args.includes('--clean'),
  build: args.includes('--build'), 
  verify: args.includes('--verify'),
  help: args.includes('--help') || args.includes('-h')
}

if (options.help) {
  console.log(`
Build Artifact Policy Enforcement

Usage: node scripts/build-policy-check.js [options]

Options:
  --clean     Clean all build artifacts before checks
  --build     Build all packages after checks
  --verify    Verify build hashes match source code
  --help, -h  Show this help message

Examples:
  node scripts/build-policy-check.js --clean --build    # Clean and rebuild
  node scripts/build-policy-check.js --verify           # Verify existing builds
  node scripts/build-policy-check.js --clean --verify   # Clean and verify
`)
  process.exit(0)
}

// Run the policy enforcer
const enforcer = new BuildArtifactPolicyEnforcer()
await enforcer.enforce(options)