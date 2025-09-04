#!/usr/bin/env node

/**
 * Validates that package.json exports match tsup entry points
 * Ensures consistency between build configuration and package exports
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packageRoot = path.resolve(__dirname, '..')
const packageJsonPath = path.join(packageRoot, 'package.json')
const tsupConfigPath = path.join(packageRoot, 'tsup.config.ts')

async function loadPackageJson() {
  const content = await fs.promises.readFile(packageJsonPath, 'utf-8')
  return JSON.parse(content)
}

// Smart extractor: supports both object and array entry forms
async function extractTsupEntriesSmart() {
  const content = await fs.promises.readFile(tsupConfigPath, 'utf-8')

  // Try object form: entry: { ... }
  const objectMatch = content.match(/entry:\s*{([\s\S]*?)}/m)
  if (objectMatch) {
    const entries = []
    const lines = objectMatch[1].split('\n')
    lines.forEach((line) => {
      const match = line.match(/['\"]([^'\"]+)['\"]\s*:\s*['\"]([^'\"]+)['\"]/)
      if (match) {
        const [, outputPath, sourcePath] = match
        entries.push({ output: outputPath, source: sourcePath })
      }
    })
    return entries
  }

  // Try array form: entry: ['src/...']
  const arrayMatch = content.match(/entry:\s*\[(.*?)\]/s)
  if (arrayMatch) {
    const body = arrayMatch[1]
    const items = []
    const re = /['"`]([^'"`]+)['"`]/g
    let m
    while ((m = re.exec(body)) !== null) {
      items.push(m[1])
    }
    return items.map((sourcePath) => {
      const noSrc = sourcePath.replace(/^src\//, '')
      const noExt = noSrc.replace(/\.tsx?$/, '')
      return { output: noExt, source: sourcePath }
    })
  }

  throw new Error('Could not find entry configuration in tsup.config.ts')
}

async function extractTsupEntries() {
  const content = await fs.promises.readFile(tsupConfigPath, 'utf-8')
  
  // Extract entry configuration from tsup.config.ts
  const entryMatch = content.match(/entry:\s*{([^}]+)}/s)
  if (!entryMatch) {
    throw new Error('Could not find entry configuration in tsup.config.ts')
  }
  
  const entries = []
  const entryContent = entryMatch[1]
  const lines = entryContent.split('\n')
  
  lines.forEach((line) => {
    // Match lines like: 'blocks/index': 'src/blocks/index.ts',
    const match = line.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/)
    if (match) {
      const [, outputPath, sourcePath] = match
      entries.push({
        output: outputPath,
        source: sourcePath,
      })
    }
  })
  
  return entries
}

async function validateExports() {
  try {
    const packageJson = await loadPackageJson()
    const tsupEntries = await extractTsupEntriesSmart()
    
    const exports = packageJson.exports || {}
    const errors = []
    const warnings = []
    
    console.log('📦 Validating package exports...\n')
    
    // Check that main export exists
    if (!exports['.']) {
      errors.push('Missing main export "." in package.json')
    }
    
    // Validate each tsup entry has a corresponding export
    tsupEntries.forEach(({ output, source }) => {
      // Skip lib/utils as it's a special case
      if (output === 'lib/utils') {
        if (!exports['./lib/utils']) {
          errors.push(`Missing export for "./lib/utils" (tsup entry: ${output})`)
        }
        return
      }
      
      // Convert tsup entry to export path
      let exportPath = './' + output.replace('/index', '')
      if (exportPath === './index') {
        exportPath = '.'
      }
      
      // Check if export exists
      if (!exports[exportPath]) {
        // Check for wildcard exports
        const hasWildcard = Object.keys(exports).some((key) => {
          if (key.includes('*')) {
            const pattern = key.replace('*', '.*')
            return new RegExp(pattern).test(exportPath)
          }
          return false
        })
        
        if (!hasWildcard) {
          errors.push(`Missing export for "${exportPath}" (tsup entry: ${output})`)
        }
      } else {
        // Validate export structure
        const exportConfig = exports[exportPath]
        
        if (exportPath !== './styles/globals.css' && exportPath !== './package.json') {
          if (!exportConfig.types && !exportConfig.import) {
            errors.push(`Export "${exportPath}" missing types or import field`)
          }
          
          if (exportConfig.types) {
            const expectedTypes = `./dist/types/${output}.d.ts`
            if (!exportConfig.types.includes('dist/types')) {
              warnings.push(`Export "${exportPath}" types field doesn't point to dist/types`)
            }
          }
          
          if (exportConfig.import) {
            const expectedImport = `./dist/js/${output}.js`
            if (!exportConfig.import.includes('dist/js')) {
              warnings.push(`Export "${exportPath}" import field doesn't point to dist/js`)
            }
          }
        }
      }
    })
    
    // Check for exports without corresponding tsup entries
    Object.keys(exports).forEach((exportPath) => {
      // Skip special exports
      if (
        exportPath === './package.json' ||
        exportPath === './styles/globals.css' ||
        exportPath.includes('*')
      ) {
        return
      }
      
      // Convert export path to tsup entry format
      let entryName = exportPath.replace('./', '')
      if (entryName === '.') {
        entryName = 'index'
      } else if (!entryName.includes('index')) {
        entryName = entryName + '/index'
      }
      
      // Special case for lib/utils
      if (exportPath === './lib/utils') {
        entryName = 'lib/utils'
      }
      
      const hasEntry = tsupEntries.some((e) => e.output === entryName)
      if (!hasEntry) {
        warnings.push(`Export "${exportPath}" has no corresponding tsup entry`)
      }
    })

    // Validate wildcard exports point to actual built files
    const wildcardExports = Object.entries(exports).filter(([key]) => key.includes('*'))
    for (const [exportPath, cfg] of wildcardExports) {
      const importPath = typeof cfg === 'string' ? cfg : cfg.import
      const typesPath = typeof cfg === 'string' ? null : cfg.types

      const checkDirHasFiles = (p, ext) => {
        if (!p) return true
        // Convert ./dist/js/blocks/*.js -> dist/js/blocks
        const rel = p.replace(/^\.\//, '')
        const dir = path.join(packageRoot, path.dirname(rel))
        try {
          const files = fs.readdirSync(dir)
          const matched = files.filter((f) => f.endsWith(ext) && f !== 'index.js' && f !== 'index.d.ts')
          if (matched.length === 0) {
            warnings.push(`Wildcard export "${exportPath}" points to empty directory: ${dir}`)
          }
        } catch (e) {
          errors.push(`Wildcard export "${exportPath}" points to missing directory: ${dir}`)
        }
      }

      checkDirHasFiles(importPath, '.js')
      checkDirHasFiles(typesPath, '.d.ts')
    }
    
    // Report results
    if (errors.length > 0) {
      console.error('❌ Export validation failed!\n')
      console.error('Errors:')
      errors.forEach((error) => {
        console.error(`  - ${error}`)
      })
    }
    
    if (warnings.length > 0) {
      console.warn('\n⚠️  Warnings:')
      warnings.forEach((warning) => {
        console.warn(`  - ${warning}`)
      })
    }
    
    if (errors.length === 0) {
      console.log('✅ All exports properly configured')
      console.log(`✅ ${tsupEntries.length} entries match exports`)
      
      if (warnings.length === 0) {
        console.log('✅ No warnings found')
      }
      
      process.exit(0)
    } else {
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Failed to validate exports:', error.message)
    process.exit(1)
  }
}

// Run validation
validateExports()
/* eslint-env node */
/* eslint no-console: off */
/* eslint no-useless-escape: off */
