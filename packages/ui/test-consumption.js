#!/usr/bin/env node
/* eslint-env node */
/* eslint no-console: off */
/* global process */

/**
 * Test script to verify the UI package can be consumed correctly
 * Tests that Next/Sentry are not exposed in root exports
 */

import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testPackageExports() {
  console.log('🧪 Testing @elevate/ui package exports...\n')
  
  const distIndexPath = join(__dirname, 'dist/js/index.js')
  const indexContent = await readFile(distIndexPath, 'utf-8')
  
  const tests = [
    {
      name: 'Root index should NOT export Next.js components',
      check: () => !indexContent.includes('next/index') && !indexContent.includes('AdminLayout') && !indexContent.includes('ClientHeader'),
      error: '❌ Root index is leaking Next.js exports'
    },
    {
      name: 'Root index should NOT export Sentry components',
      check: () => !indexContent.includes('feedback/index') && !indexContent.includes('SentryBoundary'),
      error: '❌ Root index is leaking Sentry exports'
    },
    {
      name: 'Root index SHOULD export shadcn primitives',
      check: () => indexContent.includes('Button') && indexContent.includes('Badge') && indexContent.includes('Card'),
      error: '❌ Root index is missing shadcn primitives'
    },
    {
      name: 'Root index SHOULD export utils',
      check: () => indexContent.includes('cn'),
      error: '❌ Root index is missing cn utility'
    }
  ]
  
  let allPassed = true
  
  for (const test of tests) {
    try {
      if (test.check()) {
        console.log(`✅ ${test.name}`)
      } else {
        console.error(`${test.error}`)
        allPassed = false
      }
    } catch (err) {
      console.error(`❌ ${test.name} - Error: ${err.message}`)
      allPassed = false
    }
  }
  
  // Test subpath exports exist
  console.log('\n📦 Testing subpath exports...\n')
  
  const subpaths = [
    { path: 'dist/js/blocks/index.js', name: 'blocks' },
    { path: 'dist/js/blocks/sections/index.js', name: 'blocks/sections' },
    { path: 'dist/js/next/index.js', name: 'next' },
    { path: 'dist/js/feedback/index.js', name: 'feedback' },
    { path: 'dist/styles/globals.css', name: 'styles/globals.css' }
  ]
  
  for (const subpath of subpaths) {
    try {
      const fullPath = join(__dirname, subpath.path)
      await readFile(fullPath, 'utf-8')
      console.log(`✅ Subpath @elevate/ui/${subpath.name} exists`)
    } catch (err) {
      console.error(`❌ Subpath @elevate/ui/${subpath.name} not found`)
      allPassed = false
    }
  }
  
  // Test that blocks don't import Next.js
  console.log('\n🔍 Testing framework isolation...\n')
  
  const blocksPath = join(__dirname, 'dist/js/blocks/index.js')
  const blocksContent = await readFile(blocksPath, 'utf-8')
  
  if (!blocksContent.includes('next/link') && !blocksContent.includes('next/navigation')) {
    console.log('✅ Blocks are framework-agnostic')
  } else {
    console.error('❌ Blocks contain Next.js imports')
    allPassed = false
  }
  
  // Summary
  console.log('\n' + '='.repeat(50))
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Package is correctly structured!')
    console.log('\nKey achievements:')
    console.log('• Next/Sentry isolated to subpaths only')
    console.log('• Root exports only shadcn primitives + utils')
    console.log('• Framework-agnostic blocks')
    console.log('• All subpath exports available')
  } else {
    console.error('❌ SOME TESTS FAILED - Review the errors above')
    process.exit(1)
  }
}

testPackageExports().catch(console.error)
