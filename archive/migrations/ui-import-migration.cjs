#!/usr/bin/env node

/**
 * Simple codemod to migrate imports from root @elevate/ui to subpath imports
 * 
 * Examples:
 *   import { FileUpload } from '@elevate/ui' → import { FileUpload } from '@elevate/ui/blocks'
 *   import { HeroSection } from '@elevate/ui' → import { HeroSection } from '@elevate/ui/blocks/sections'
 */

const fs = require('fs')
const path = require('path')

const { glob } = require('fast-glob')

// Component mappings - blocks that should use subpath imports
const BLOCK_COMPONENTS = [
  'FileUpload', 'FileList',
  'Modal', 'ConfirmModal', 
  'LoadingSpinner',
  'StatusBadge',
  'ShareButton',
  'MetricsChart',
  'LeaderboardPreview',
  'StoriesGrid',
  'CsrfProtectedForm',
  'LanguageSwitcher'
]

const SECTION_COMPONENTS = [
  'HeroSection',
  'DualPaths', 
  'ProgramFlow',
  'ImpactRipple',
  'ConveningTeaser',
  'FAQList',
  'PartnersContact'
]

const FEEDBACK_COMPONENTS = [
  'ErrorBoundary',
  'SentryBoundary',
  'PageErrorBoundary',
  'ComponentErrorBoundary',
  'SectionErrorBoundary'
]

const NEXT_COMPONENTS = [
  'RedirectPage',
  'NotFoundPage'
]

// Build mapping of component name to subpath
const COMPONENT_TO_SUBPATH = new Map()

BLOCK_COMPONENTS.forEach(name => COMPONENT_TO_SUBPATH.set(name, '@elevate/ui/blocks'))
SECTION_COMPONENTS.forEach(name => COMPONENT_TO_SUBPATH.set(name, '@elevate/ui/blocks/sections'))
FEEDBACK_COMPONENTS.forEach(name => COMPONENT_TO_SUBPATH.set(name, '@elevate/ui/feedback'))
NEXT_COMPONENTS.forEach(name => COMPONENT_TO_SUBPATH.set(name, '@elevate/ui/next'))

/**
 * Parse import statement and extract imported names
 * Handles: import { A, B } from '@elevate/ui'
 * Handles: import { A as B, C } from '@elevate/ui'
 */
function parseImportStatement(line) {
  const importMatch = line.match(/^import\s+\{([^}]+)\}\s+from\s+['"](@elevate\/ui)['"]/)
  if (!importMatch) return null

  const [, importList, packageName] = importMatch
  
  // Parse imported names, handling 'as' aliases
  const imports = importList
    .split(',')
    .map(item => {
      const trimmed = item.trim()
      const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
      if (asMatch) {
        return { original: asMatch[1], alias: asMatch[2] }
      } else {
        return { original: trimmed, alias: null }
      }
    })
    .filter(item => item.original)

  return {
    packageName,
    imports,
    fullMatch: importMatch[0]
  }
}

/**
 * Group imports by their target subpath
 */
function groupImportsBySubpath(imports) {
  const groups = new Map()
  
  for (const importItem of imports) {
    const subpath = COMPONENT_TO_SUBPATH.get(importItem.original) || '@elevate/ui'
    
    if (!groups.has(subpath)) {
      groups.set(subpath, [])
    }
    groups.get(subpath).push(importItem)
  }

  return groups
}

/**
 * Generate new import statements from grouped imports
 */
function generateImportStatements(groups) {
  const statements = []
  
  for (const [subpath, imports] of groups.entries()) {
    const importNames = imports.map(item => 
      item.alias ? `${item.original} as ${item.alias}` : item.original
    ).join(', ')
    
    statements.push(`import { ${importNames} } from '${subpath}'`)
  }
  
  return statements.sort() // Sort for consistency
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  
  let modified = false
  const newLines = []
  
  for (const line of lines) {
    const parsed = parseImportStatement(line)
    
    if (parsed && parsed.packageName === '@elevate/ui') {
      // Check if any imports need migration
      const needsMigration = parsed.imports.some(item => 
        COMPONENT_TO_SUBPATH.has(item.original)
      )
      
      if (needsMigration) {
        // Group imports by their target subpath
        const groups = groupImportsBySubpath(parsed.imports)
        
        // Generate new import statements
        const newStatements = generateImportStatements(groups)
        
        // Replace the original line with new statements
        newLines.push(...newStatements)
        modified = true
        
        console.log(`  📝 ${path.relative(process.cwd(), filePath)}:`)
        console.log(`    - ${parsed.fullMatch}`)
        newStatements.forEach(stmt => console.log(`    + ${stmt}`))
      } else {
        // Keep the original import as-is
        newLines.push(line)
      }
    } else {
      // Not an @elevate/ui import, keep as-is
      newLines.push(line)
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'))
    return true
  }
  
  return false
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('🔄 Import Migration Codemod')
    console.log('')
    console.log('Usage:')
    console.log('  node migrate-imports.js <patterns...>')
    console.log('')
    console.log('Examples:')
    console.log('  node migrate-imports.js "src/**/*.{ts,tsx}"')
    console.log('  node migrate-imports.js "app/**/*.tsx" "pages/**/*.tsx"')
    console.log('  node migrate-imports.js file1.tsx file2.tsx')
    process.exit(0)
  }

  console.log('🔄 Migrating @elevate/ui imports to subpaths...')
  console.log('')
  
  const patterns = args
  let totalFiles = 0
  let modifiedFiles = 0

  for (const pattern of patterns) {
    let files
    
    if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) {
      // Single file
      files = [pattern]
    } else {
      // Glob pattern
      files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**']
      })
    }

    for (const file of files) {
      totalFiles++
      const wasModified = processFile(file)
      if (wasModified) {
        modifiedFiles++
      }
    }
  }

  console.log('')
  console.log('✅ Migration complete!')
  console.log(`   Files scanned: ${totalFiles}`)
  console.log(`   Files modified: ${modifiedFiles}`)
  
  if (modifiedFiles > 0) {
    console.log('')
    console.log('🔧 Next steps:')
    console.log('   1. Review the changes')
    console.log('   2. Run your type checker: npm run type-check')
    console.log('   3. Run tests to ensure everything still works')
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Migration failed:', error)
  process.exit(1)
})

if (require.main === module) {
  main()
}