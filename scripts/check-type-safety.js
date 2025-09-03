#!/usr/bin/env node

/**
 * Type Safety Checker
 * 
 * This script scans the codebase for unsafe type casting patterns and ensures
 * type safety best practices are maintained.
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// Patterns to check for unsafe type casting
const UNSAFE_PATTERNS = [
  {
    pattern: /\s+as\s+any\b/g,
    name: 'as any cast',
    severity: 'error',
    suggestion: 'Use proper type parsing functions or create specific types'
  },
  {
    pattern: /\bas\s+unknown\s+as\s+/g,
    name: 'as unknown as cast',
    severity: 'warning', 
    suggestion: 'Consider using type guards or parsing functions'
  },
  {
    pattern: /any\[\]/g,
    name: 'any[] type',
    severity: 'warning',
    suggestion: 'Use specific array types like T[] or readonly T[]'
  },
  {
    pattern: /:\s*any\b(?!\[\])/g,
    name: 'any type annotation',
    severity: 'warning',
    suggestion: 'Use specific types or unknown for truly unknown data'
  },
  {
    pattern: /@ts-ignore/g,
    name: '@ts-ignore comment',
    severity: 'warning',
    suggestion: 'Use @ts-expect-error with explanation instead'
  }
]

// Files and directories to scan
const SCAN_PATTERNS = [
  'apps/**/*.{ts,tsx}',
  'packages/**/*.{ts,tsx}',
  '!node_modules/**',
  '!**/*.d.ts',
  '!**/dist/**',
  '!**/.next/**'
]

// Files to exclude (legacy or third-party)
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.d\.ts$/,
  /dist\//,
  /\.next\//,
  /__tests__\/.*\.test\.ts$/, // Allow some flexibility in tests
  /scripts\//
]

class TypeSafetyChecker {
  constructor() {
    this.errors = []
    this.warnings = []
    this.filesScanned = 0
  }

  shouldExcludeFile(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath))
  }

  scanFile(filePath) {
    if (this.shouldExcludeFile(filePath)) {
      return
    }

    this.filesScanned++
    
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n')
      
      UNSAFE_PATTERNS.forEach(({ pattern, name, severity, suggestion }) => {
        let match
        pattern.lastIndex = 0 // Reset regex state
        
        while ((match = pattern.exec(content)) !== null) {
          const beforeMatch = content.substring(0, match.index)
          const lineNumber = beforeMatch.split('\n').length
          const lineContent = lines[lineNumber - 1] || ''
          
          const issue = {
            file: path.relative(process.cwd(), filePath),
            line: lineNumber,
            column: match.index - beforeMatch.lastIndexOf('\n'),
            pattern: name,
            suggestion,
            code: lineContent.trim(),
            match: match[0]
          }
          
          if (severity === 'error') {
            this.errors.push(issue)
          } else {
            this.warnings.push(issue)
          }
        }
      })
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message)
    }
  }

  async scanDirectory() {
    console.log('🔍 Scanning codebase for type safety issues...\n')
    
    for (const pattern of SCAN_PATTERNS) {
      const files = glob.sync(pattern, { 
        cwd: process.cwd(),
        ignore: ['node_modules/**']
      })
      
      files.forEach(file => this.scanFile(path.join(process.cwd(), file)))
    }
  }

  printResults() {
    console.log(`📊 Scanned ${this.filesScanned} files\n`)
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No type safety issues found! Great job!')
      return true
    }
    
    if (this.errors.length > 0) {
      console.log(`❌ Found ${this.errors.length} type safety errors:\n`)
      
      this.errors.forEach(({ file, line, pattern, suggestion, code, match }, index) => {
        console.log(`${index + 1}. ${file}:${line}`)
        console.log(`   Pattern: ${pattern}`)
        console.log(`   Code: ${code}`)
        console.log(`   Match: "${match}"`)
        console.log(`   💡 ${suggestion}\n`)
      })
    }
    
    if (this.warnings.length > 0) {
      console.log(`⚠️  Found ${this.warnings.length} type safety warnings:\n`)
      
      this.warnings.forEach(({ file, line, pattern, suggestion, code }, index) => {
        console.log(`${index + 1}. ${file}:${line}`)
        console.log(`   Pattern: ${pattern}`)
        console.log(`   Code: ${code}`)
        console.log(`   💡 ${suggestion}\n`)
      })
    }
    
    // Return false if there are errors (for CI failure)
    return this.errors.length === 0
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      filesScanned: this.filesScanned,
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        passed: this.errors.length === 0
      },
      issues: {
        errors: this.errors,
        warnings: this.warnings
      }
    }
    
    // Write JSON report for CI systems
    fs.writeFileSync(
      path.join(process.cwd(), 'type-safety-report.json'),
      JSON.stringify(report, null, 2)
    )
    
    console.log('\n📋 Report saved to type-safety-report.json')
  }
}

// Best practices documentation
function printBestPractices() {
  console.log(`
📚 Type Safety Best Practices:

1. Instead of 'as any', use:
   - Zod parsers: parseActivityCode(), parseSubmissionStatus()
   - Type guards: if (typeof x === 'string')
   - Unknown type: as unknown (then narrow down)

2. For Prisma JSON fields:
   - Use toPrismaJson() helper function
   - Define specific schemas with Zod

3. For external APIs:
   - Create interface definitions
   - Use parsing functions to validate responses
   - Handle errors gracefully with proper types

4. For union types:
   - Use discriminated unions
   - Implement type guards
   - Use exhaustive checking with never

5. Avoid @ts-ignore:
   - Use @ts-expect-error with explanation
   - Fix the underlying type issue
   - Use proper type assertions

For more details, see the project's type safety documentation.
`)
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help')) {
    console.log(`
Usage: node check-type-safety.js [options]

Options:
  --help          Show this help message
  --best-practices Show type safety best practices
  --strict        Treat warnings as errors
  --report        Generate JSON report (always generated)

Exit codes:
  0: No type safety errors found
  1: Type safety errors found
  2: Script execution error
`)
    process.exit(0)
  }
  
  if (args.includes('--best-practices')) {
    printBestPractices()
    process.exit(0)
  }
  
  const strict = args.includes('--strict')
  
  try {
    const checker = new TypeSafetyChecker()
    await checker.scanDirectory()
    const passed = checker.printResults()
    checker.generateReport()
    
    // In strict mode, warnings also cause failure
    const success = strict ? (checker.errors.length === 0 && checker.warnings.length === 0) : passed
    
    if (!success) {
      console.log('\n❌ Type safety check failed!')
      if (strict && checker.warnings.length > 0) {
        console.log('(Running in strict mode - warnings treated as errors)')
      }
      process.exit(1)
    } else {
      console.log('\n✅ Type safety check passed!')
      process.exit(0)
    }
    
  } catch (error) {
    console.error('💥 Script execution error:', error.message)
    process.exit(2)
  }
}

if (require.main === module) {
  main()
}

module.exports = { TypeSafetyChecker, UNSAFE_PATTERNS }