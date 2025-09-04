#!/usr/bin/env node

/**
 * CI script to detect duplicate shadcn components outside the ui/ directory
 * This ensures we maintain a single source of truth for UI primitives
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packageRoot = path.resolve(__dirname, '..')
const uiDir = path.join(packageRoot, 'src', 'components', 'ui')
const componentsDir = path.join(packageRoot, 'src', 'components')
const blocksDir = path.join(packageRoot, 'src', 'blocks')

// List of shadcn primitive names to check
const shadcnPrimitives = [
  'alert',
  'badge',
  'button',
  'card',
  'dialog',
  'form',
  'input',
  'label',
  'select',
  'table',
  'textarea',
]

function checkForDuplicates() {
  let hasErrors = false
  const duplicates = []

  // Check if UI directory exists
  if (!fs.existsSync(uiDir)) {
    console.error(`❌ UI directory not found: ${uiDir}`)
    process.exit(1)
  }

  // Get all files in the ui directory
  const uiFiles = fs.readdirSync(uiDir).filter((f) => f.endsWith('.tsx'))
  const uiBasenames = new Set(uiFiles.map((f) => path.basename(f, '.tsx')))

  // Check components directory for duplicates
  if (fs.existsSync(componentsDir)) {
    const componentFiles = fs
      .readdirSync(componentsDir)
      .filter((f) => {
        const fullPath = path.join(componentsDir, f)
        return (
          f.endsWith('.tsx') &&
          fs.statSync(fullPath).isFile() &&
          !fullPath.includes('/ui/')
        )
      })

    componentFiles.forEach((file) => {
      const basename = path.basename(file, '.tsx')
      if (shadcnPrimitives.includes(basename) && uiBasenames.has(basename)) {
        duplicates.push({
          file: path.join('src/components', file),
          shouldBe: path.join('src/components/ui', file),
        })
        hasErrors = true
      }
    })
  }

  // Check blocks directory for shadcn primitives (should not exist there)
  if (fs.existsSync(blocksDir)) {
    const checkDirectory = (dir, relativePath = '') => {
      const files = fs.readdirSync(dir)
      files.forEach((file) => {
        const fullPath = path.join(dir, file)
        const relPath = path.join(relativePath, file)
        
        if (fs.statSync(fullPath).isDirectory()) {
          checkDirectory(fullPath, relPath)
        } else if (file.endsWith('.tsx')) {
          const basename = path.basename(file, '.tsx')
          if (shadcnPrimitives.includes(basename)) {
            duplicates.push({
              file: path.join('src/blocks', relPath),
              shouldBe: path.join('src/components/ui', file),
            })
            hasErrors = true
          }
        }
      })
    }
    
    checkDirectory(blocksDir)
  }

  // Report results
  if (hasErrors) {
    console.error('❌ Duplicate shadcn components detected!\n')
    console.error('The following files are duplicates of shadcn primitives:')
    duplicates.forEach(({ file, shouldBe }) => {
      console.error(`  - ${file}`)
      console.error(`    → Should only exist in: ${shouldBe}`)
    })
    console.error('\nPlease remove duplicate components and use imports from components/ui/')
    process.exit(1)
  }

  console.log('✅ No duplicate shadcn components found')
  console.log(`✅ All ${uiFiles.length} primitives properly located in components/ui/`)
}

// Validate that all expected shadcn components exist
function validateShadcnComponents() {
  const missingComponents = []
  
  shadcnPrimitives.forEach((primitive) => {
    const componentPath = path.join(uiDir, `${primitive}.tsx`)
    if (!fs.existsSync(componentPath)) {
      missingComponents.push(primitive)
    }
  })
  
  if (missingComponents.length > 0) {
    console.warn('⚠️  Missing shadcn components:')
    missingComponents.forEach((comp) => {
      console.warn(`  - ${comp}.tsx`)
    })
    console.warn('\nConsider adding these with: npx shadcn@latest add <component>')
  }
}

// Run checks
console.log('🔍 Checking for duplicate shadcn components...\n')
checkForDuplicates()
validateShadcnComponents()