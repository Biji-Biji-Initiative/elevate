#!/usr/bin/env node
/*
  Enhanced secret scanner for Elevate LEAPS Tracker
  Comprehensive detection of secrets, credentials, and sensitive data
  with advanced patterns and configurable reporting.
*/
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs'
import { join, relative, basename, extname } from 'path'

const ROOT = process.cwd()
const SCAN_ROOTS = ['packages', 'apps']
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'docs',
  'fixtures',
  'tests',
  '__tests__',
  '.vercel',
  '.githooks',
  '.clerk',
  'supabase/.temp',
  '.secrets',  // Our encrypted vault directory
  '.env-local' // Local development directory
])

const IGNORE_FILES = [
  /\.env(\..*)?$/, 
  /\.(png|jpg|jpeg|gif|svg|webp)$/i, 
  /\.map$/, 
  /\.(md|mdx)$/i,
  /\.vault$/,  // Our encrypted vault files
  /\.log$/,
  /\.lock$/,
  /\.pid$/
]

// Enhanced patterns with severity levels and categories
const PATTERNS = [
  // Critical - Actual secrets that must never be committed
  { 
    re: /(sk|rk)_(live|prod)_[A-Za-z0-9]{20,}/gi, 
    why: 'Production secret key token', 
    severity: 'critical',
    category: 'api-key'
  },
  { 
    re: /whsec_[A-Za-z0-9+/=\-_]{20,}/gi, 
    why: 'Webhook secret', 
    severity: 'critical',
    category: 'webhook'
  },
  { 
    re: /postgresql:\/\/[A-Za-z0-9._%-]+:[^@\s]+@[^\s/]+/gi, 
    why: 'Database connection string with password', 
    severity: 'critical',
    category: 'database'
  },
  
  // High - Sensitive keys and tokens
  { 
    re: /(sk|rk)_(test)_[A-Za-z0-9]{20,}/gi, 
    why: 'Test secret key token', 
    severity: 'high',
    category: 'api-key'
  },
  { 
    re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gi, 
    why: 'JWT token', 
    severity: 'high',
    category: 'token'
  },
  { 
    re: /re_[A-Za-z0-9_-]{16,}/gi, 
    why: 'Resend API key', 
    severity: 'high',
    category: 'api-key'
  },
  { 
    re: /sk-[A-Za-z0-9_-]{48,}/gi, 
    why: 'OpenAI API key', 
    severity: 'high',
    category: 'api-key'
  },
  
  // Medium - Environment variable declarations (might be in code)
  { 
    re: /SUPABASE_(SERVICE_ROLE|ANON)_KEY\s*=\s*[A-Za-z0-9.\-_]{20,}/gi, 
    why: 'Supabase key assignment in code', 
    severity: 'medium',
    category: 'env-var'
  },
  { 
    re: /CLERK_(SECRET|PUBLISHABLE)_KEY\s*=\s*[A-Za-z0-9._-]{20,}/gi, 
    why: 'Clerk key assignment in code', 
    severity: 'medium',
    category: 'env-var'
  },
  { 
    re: /(DATABASE_URL|DIRECT_URL)\s*=\s*postgresql:\/\/[^\s'"]+/gi, 
    why: 'Database URL assignment in code', 
    severity: 'medium',
    category: 'env-var'
  },
  
  // Low - Potential issues or patterns to review
  { 
    re: /password\s*[:=]\s*['"]\w{8,}['"]/gi, 
    why: 'Hardcoded password pattern', 
    severity: 'low',
    category: 'hardcoded'
  },
  { 
    re: /api[_-]?key\s*[:=]\s*['"]\w{16,}['"]/gi, 
    why: 'Hardcoded API key pattern', 
    severity: 'low',
    category: 'hardcoded'
  },
  { 
    re: /secret\s*[:=]\s*['"]\w{16,}['"]/gi, 
    why: 'Hardcoded secret pattern', 
    severity: 'low',
    category: 'hardcoded'
  },
  
  // Elevate-specific patterns
  { 
    re: /ElevateIndo\d{4}[!@#$%^&*]/gi, 
    why: 'Elevate password pattern', 
    severity: 'critical',
    category: 'password'
  },
  { 
    re: /kajabi[_-]?(webhook[_-]?)?secret\s*[:=]\s*[^\s'"]+/gi, 
    why: 'Kajabi webhook secret', 
    severity: 'high',
    category: 'webhook'
  },
  { 
    re: /3bSjqrBysXjszB3TtFgSSKSV|bEiFQSQiRzeyHZxfP4En52oo/gi, 
    why: 'Known Kajabi credentials', 
    severity: 'critical',
    category: 'known-secret'
  },
  { 
    re: /gsvhfcjmjnocxxosjloi|aws-0-ap-southeast-1\.pooler\.supabase\.com/gi, 
    why: 'Supabase project identifier', 
    severity: 'medium',
    category: 'identifier'
  }
]

const findings = []
const args = process.argv.slice(2)
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  json: args.includes('--json'),
  severity: getSeverityFilter(args),
  report: args.includes('--report'),
  fix: args.includes('--fix'),
  allowlist: loadAllowlist()
}

function getSeverityFilter(args) {
  const severityIndex = args.findIndex(arg => arg === '--severity')
  if (severityIndex !== -1 && args[severityIndex + 1]) {
    return args[severityIndex + 1].toLowerCase()
  }
  return 'all'
}

function loadAllowlist() {
  const allowlistPath = join(ROOT, '.secrets-allowlist.json')
  if (existsSync(allowlistPath)) {
    try {
      return JSON.parse(readFileSync(allowlistPath, 'utf8'))
    } catch {
      console.warn('⚠️  Warning: Invalid .secrets-allowlist.json format')
    }
  }
  return { files: [], patterns: [], hashes: [] }
}

function shouldIgnore(name, path = '') {
  if (IGNORE_FILES.some((re) => re.test(name))) return true
  
  // Check allowlist
  if (options.allowlist.files.includes(relative(ROOT, path))) return true
  
  return false
}

function isAllowlisted(finding) {
  const { file, pattern, match } = finding
  
  // Check file allowlist
  if (options.allowlist.files.includes(file)) return true
  
  // Check pattern allowlist
  const patternKey = `${file}:${pattern.category}`
  if (options.allowlist.patterns.includes(patternKey)) return true
  
  // Check hash allowlist (for specific matches)
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(`${file}:${match}`).digest('hex').substring(0, 16)
  if (options.allowlist.hashes.includes(hash)) return true
  
  return false
}

function getMatchDetails(content, pattern, filePath) {
  const lines = content.split('\n')
  const matches = []
  
  let match
  pattern.re.lastIndex = 0 // Reset regex state
  
  while ((match = pattern.re.exec(content)) !== null) {
    const beforeMatch = content.substring(0, match.index)
    const lineNumber = beforeMatch.split('\n').length
    const lineStart = beforeMatch.lastIndexOf('\n') + 1
    const columnNumber = match.index - lineStart + 1
    const line = lines[lineNumber - 1]
    
    matches.push({
      match: match[0],
      line: lineNumber,
      column: columnNumber,
      context: line.trim(),
      pattern: pattern
    })
    
    // Prevent infinite loops on global regexes
    if (!pattern.re.global) break
  }
  
  return matches
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    
    try {
      const st = statSync(full)
      if (st.isDirectory()) {
        if (!IGNORE_DIRS.has(entry) && !entry.startsWith('.')) {
          walk(full)
        }
        continue
      }
      
      // Skip test files
      if (rel.includes('/__tests__/') || rel.includes('/test/') || rel.startsWith('tests/')) continue
      
      // Skip ignored files
      if (shouldIgnore(entry, full)) continue
      
      // Skip large files (>1MB) to avoid performance issues
      if (st.size > 1024 * 1024) continue
      
      const content = readFileSync(full, 'utf8')
      
      for (const pattern of PATTERNS) {
        if (pattern.re.test(content)) {
          const matches = getMatchDetails(content, pattern, rel)
          
          for (const matchDetail of matches) {
            const finding = {
              file: rel,
              ...matchDetail,
              severity: pattern.severity,
              category: pattern.category
            }
            
            // Skip if allowlisted
            if (isAllowlisted(finding)) {
              if (options.verbose) {
                console.log(`ℹ️  Allowlisted: ${rel}:${matchDetail.line} - ${pattern.why}`)
              }
              continue
            }
            
            // Apply severity filter
            if (options.severity !== 'all' && pattern.severity !== options.severity) {
              continue
            }
            
            findings.push(finding)
          }
        }
      }
    } catch (error) {
      if (options.verbose) {
        console.warn(`⚠️  Warning: Could not scan ${rel}: ${error.message}`)
      }
    }
  }
}

// Scan specified roots
for (const base of SCAN_ROOTS) {
  try {
    const scanPath = join(ROOT, base)
    if (existsSync(scanPath)) {
      walk(scanPath)
    } else if (options.verbose) {
      console.warn(`⚠️  Warning: Scan root not found: ${base}`)
    }
  } catch (error) {
    if (options.verbose) {
      console.error(`❌ Error scanning ${base}: ${error.message}`)
    }
  }
}

// Generate report
function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    },
    findings: findings.map(f => ({
      file: f.file,
      line: f.line,
      column: f.column,
      severity: f.severity,
      category: f.category,
      description: f.pattern.why,
      context: f.context,
      match: options.verbose ? f.match : '[REDACTED]'
    })),
    categories: [...new Set(findings.map(f => f.category))],
    recommendations: generateRecommendations()
  }
  
  if (options.report) {
    const reportPath = join(ROOT, 'secrets-scan-report.json')
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📊 Report saved to: ${reportPath}`)
  }
  
  return report
}

function generateRecommendations() {
  const recommendations = []
  const categories = new Set(findings.map(f => f.category))
  
  if (categories.has('api-key')) {
    recommendations.push('Move API keys to environment variables or encrypted vault')
  }
  if (categories.has('database')) {
    recommendations.push('Use environment variables for database connection strings')
  }
  if (categories.has('hardcoded')) {
    recommendations.push('Replace hardcoded secrets with configuration management')
  }
  if (categories.has('webhook')) {
    recommendations.push('Store webhook secrets in secure environment variables')
  }
  if (categories.has('known-secret')) {
    recommendations.push('Rotate compromised credentials immediately')
  }
  
  return recommendations
}

// Output results
if (options.json) {
  const report = generateReport()
  console.log(JSON.stringify(report, null, 2))
} else if (findings.length > 0) {
  const critical = findings.filter(f => f.severity === 'critical')
  const high = findings.filter(f => f.severity === 'high')
  const medium = findings.filter(f => f.severity === 'medium')
  const low = findings.filter(f => f.severity === 'low')
  
  console.error('🚨 Potential secrets detected!')
  console.error(`Total: ${findings.length} (Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length}, Low: ${low.length})`)
  console.error('')
  
  // Show findings by severity
  const severityOrder = ['critical', 'high', 'medium', 'low']
  const severitySymbols = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }
  
  for (const severity of severityOrder) {
    const severityFindings = findings.filter(f => f.severity === severity)
    if (severityFindings.length === 0) continue
    
    console.error(`${severitySymbols[severity]} ${severity.toUpperCase()} (${severityFindings.length}):`)
    for (const finding of severityFindings) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column} - ${finding.pattern.why}`)
      if (options.verbose) {
        console.error(`    Context: ${finding.context}`)
        console.error(`    Category: ${finding.category}`)
      }
    }
    console.error('')
  }
  
  // Show recommendations
  const recommendations = generateRecommendations()
  if (recommendations.length > 0) {
    console.error('💡 Recommendations:')
    for (const rec of recommendations) {
      console.error(`  • ${rec}`)
    }
    console.error('')
  }
  
  // Show help for allowlisting
  console.error('ℹ️  To allowlist false positives:')
  console.error('   1. Create .secrets-allowlist.json in project root')
  console.error('   2. Add file paths, patterns, or hashes to allowlist')
  console.error('   3. Run with --verbose to see allowlist format')
  console.error('')
  
  if (options.report) {
    generateReport()
  }
  
  // Exit with error code based on severity
  const exitCode = critical.length > 0 ? 2 : (high.length > 0 ? 1 : 0)
  process.exit(exitCode)
} else {
  console.log('✅ No secrets detected')
  
  if (options.verbose) {
    console.log(`Scanned ${SCAN_ROOTS.length} directories`)
    console.log(`Applied ${PATTERNS.length} detection patterns`)
    console.log(`Severity filter: ${options.severity}`)
  }
  
  if (options.report) {
    generateReport()
  }
}
