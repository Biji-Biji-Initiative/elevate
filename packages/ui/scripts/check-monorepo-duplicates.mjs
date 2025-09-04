#!/usr/bin/env node

/**
 * Check for shadcn/ui primitives duplicated outside packages/ui
 * This ensures all UI components are centralized in the UI package
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import fg from 'fast-glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Go up to the root of the monorepo (from packages/ui/scripts)
const MONOREPO_ROOT = path.resolve(__dirname, '../../..')

// Common shadcn/ui component patterns to look for
const SHADCN_PATTERNS = [
  // Component files
  '**/ui/button.{ts,tsx,js,jsx}',
  '**/ui/card.{ts,tsx,js,jsx}',
  '**/ui/dialog.{ts,tsx,js,jsx}',
  '**/ui/input.{ts,tsx,js,jsx}',
  '**/ui/label.{ts,tsx,js,jsx}',
  '**/ui/select.{ts,tsx,js,jsx}',
  '**/ui/textarea.{ts,tsx,js,jsx}',
  '**/ui/badge.{ts,tsx,js,jsx}',
  '**/ui/alert.{ts,tsx,js,jsx}',
  '**/ui/avatar.{ts,tsx,js,jsx}',
  '**/ui/checkbox.{ts,tsx,js,jsx}',
  '**/ui/dropdown-menu.{ts,tsx,js,jsx}',
  '**/ui/form.{ts,tsx,js,jsx}',
  '**/ui/popover.{ts,tsx,js,jsx}',
  '**/ui/separator.{ts,tsx,js,jsx}',
  '**/ui/sheet.{ts,tsx,js,jsx}',
  '**/ui/skeleton.{ts,tsx,js,jsx}',
  '**/ui/switch.{ts,tsx,js,jsx}',
  '**/ui/table.{ts,tsx,js,jsx}',
  '**/ui/tabs.{ts,tsx,js,jsx}',
  '**/ui/toast.{ts,tsx,js,jsx}',
  '**/ui/toggle.{ts,tsx,js,jsx}',
  '**/ui/tooltip.{ts,tsx,js,jsx}',
  
  // Common lib files
  '**/lib/utils.{ts,tsx,js,jsx}',
  '**/lib/cn.{ts,tsx,js,jsx}',
  
  // Component index files
  '**/ui/index.{ts,tsx,js,jsx}',
  
  // Common directories that might contain shadcn components
  '**/components/ui/**/*.{ts,tsx,js,jsx}'
]

async function findDuplicates() {
  console.log('🔍 Scanning for shadcn/ui duplicates outside packages/ui...')
  console.log(`📁 Monorepo root: ${MONOREPO_ROOT}`)

  const duplicates = []

  for (const pattern of SHADCN_PATTERNS) {
    try {
      const files = await fg(pattern, {
        cwd: MONOREPO_ROOT,
        absolute: true,
        ignore: [
          // Ignore the UI package itself
          '**/packages/ui/**',
          
          // Ignore common non-source directories
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
          '**/.vercel/**',
          '**/.git/**',
          
          // Ignore test files and examples
          '**/*.test.*',
          '**/*.spec.*',
          '**/test/**',
          '**/tests/**',
          '**/examples/**',
          
          // Ignore temp and cache directories
          '**/tmp/**',
          '**/temp/**',
          '**/.cache/**'
        ]
      })

      if (files.length > 0) {
        duplicates.push({
          pattern,
          files: files.map(f => path.relative(MONOREPO_ROOT, f))
        })
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to check pattern ${pattern}:`, error.message)
    }
  }

  return duplicates
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Look for signs this is a shadcn component
    const isShadcn = (
      // Common shadcn imports
      content.includes('@radix-ui/') ||
      content.includes('class-variance-authority') ||
      content.includes('tailwind-merge') ||
      content.includes('tailwindcss-animate') ||
      content.includes('lucide-react') ||
      
      // Common shadcn patterns
      content.includes('cn(') ||
      content.includes('cva(') ||
      content.includes('VariantProps') ||
      
      // Common component patterns
      content.match(/export\s+(const|function)\s+(Button|Card|Dialog|Input|Label)/i)
    )

    return { isShadcn, content: content.slice(0, 200) + (content.length > 200 ? '...' : '') }
  } catch (error) {
    return { isShadcn: false, error: error.message }
  }
}

async function main() {
  const duplicates = await findDuplicates()

  if (duplicates.length === 0) {
    console.log('✅ No shadcn/ui duplicates found outside packages/ui')
    process.exit(0)
  }

  console.log(`❌ Found potential shadcn/ui duplicates in ${duplicates.length} patterns:`)
  console.log('')

  let totalFiles = 0
  let confirmedDuplicates = 0

  for (const { pattern, files } of duplicates) {
    console.log(`📋 Pattern: ${pattern}`)
    
    for (const file of files) {
      totalFiles++
      const fullPath = path.join(MONOREPO_ROOT, file)
      const analysis = analyzeFile(fullPath)
      
      if (analysis.isShadcn) {
        confirmedDuplicates++
        console.log(`  🚨 DUPLICATE: ${file}`)
        if (analysis.content) {
          console.log(`      Preview: ${analysis.content.split('\n')[0]}`)
        }
      } else {
        console.log(`  ℹ️  Possible: ${file}`)
        if (analysis.error) {
          console.log(`      Error: ${analysis.error}`)
        }
      }
    }
    console.log('')
  }

  console.log(`📊 Summary:`)
  console.log(`   Total files found: ${totalFiles}`)
  console.log(`   Confirmed duplicates: ${confirmedDuplicates}`)
  console.log('')

  if (confirmedDuplicates > 0) {
    console.log('🔧 Recommended actions:')
    console.log('   1. Move these components to packages/ui/src/components/ui/')
    console.log('   2. Update imports to use @elevate/ui')
    console.log('   3. Run the migration codemod: npm run migrate:imports')
    console.log('')
    
    process.exit(1)
  } else {
    console.log('✅ No confirmed duplicates found')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})