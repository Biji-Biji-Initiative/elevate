#!/usr/bin/env node
/**
 * Generate Documentation Sitemap
 * Creates a structured index of all documentation files
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

import { glob } from 'glob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

/**
 * Parse front-matter from markdown content
 */
function parseFrontMatter(content) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!frontMatterMatch) {
    return null
  }

  const yamlContent = frontMatterMatch[1]
  const frontMatter = {}

  for (const line of yamlContent.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/)
    if (match) {
      const [, key, value] = match
      if (value.startsWith('[') && value.endsWith(']')) {
        frontMatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      } else {
        frontMatter[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  }

  return frontMatter
}

/**
 * Extract title from markdown content
 */
function extractTitle(content) {
  const frontMatter = parseFrontMatter(content)
  if (frontMatter && frontMatter.title) {
    return frontMatter.title
  }

  const headingMatch = content.match(/^##\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1]
  }

  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) {
    return h1Match[1]
  }

  return 'Untitled'
}

/**
 * Categorize documentation files
 */
function categorizeDocs(files) {
  const categories = {
    Architecture: [],
    'Build & Tooling': [],
    'Backend & Database': [],
    'Security & Governance': [],
    'Product (LEAPS)': [],
    Operations: [],
    'API & Integrations': [],
    'UI & Frontend': [],
    'Package Docs': [],
    Generated: [],
    Other: [],
  }

  for (const file of files) {
    const relativePath = relative(rootDir, file.path)
    const content = readFileSync(file.path, 'utf-8')
    const title = extractTitle(content)
    const frontMatter = parseFrontMatter(content)

    const docInfo = {
      path: relativePath,
      title,
      status: frontMatter?.status || 'unknown',
      owner: frontMatter?.owner || 'unknown',
      tags: frontMatter?.tags || [],
      lastReviewed: frontMatter?.last_reviewed || 'unknown',
    }

    // Categorize based on path and content
    if (relativePath.includes('api-reports/')) {
      categories['Generated'].push(docInfo)
    } else if (
      relativePath.includes('packages/') &&
      relativePath.endsWith('README.md')
    ) {
      categories['Package Docs'].push(docInfo)
    } else if (relativePath.includes('docs/leaps/')) {
      categories['Product (LEAPS)'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('BUILDING') ||
        relativePath.includes('BUILD_') ||
        relativePath.includes('TURBO_') ||
        relativePath.includes('VALIDATION') ||
        relativePath.includes('type-safety') ||
        relativePath.includes('bundle-analysis'))
    ) {
      categories['Build & Tooling'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('DATABASE') ||
        relativePath.includes('schema') ||
        relativePath.includes('LOGGING') ||
        relativePath.includes('OBSERVABILITY'))
    ) {
      categories['Backend & Database'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('policies') ||
        relativePath.includes('roles-permissions') ||
        relativePath.includes('csrf') ||
        relativePath.includes('decisions'))
    ) {
      categories['Security & Governance'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('DEPLOYMENT') || relativePath.includes('VERCEL'))
    ) {
      categories['Operations'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('API_') ||
        relativePath.includes('openapi') ||
        relativePath.includes('kajabi') ||
        relativePath.includes('webhooks'))
    ) {
      categories['API & Integrations'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('ui-registry') || relativePath.includes('i18n'))
    ) {
      categories['UI & Frontend'].push(docInfo)
    } else if (
      relativePath.includes('docs/') &&
      (relativePath.includes('ia.md') ||
        relativePath.includes('canonical-routing') ||
        relativePath.includes('HEADER_COMPOSITION'))
    ) {
      categories['Architecture'].push(docInfo)
    } else {
      categories['Other'].push(docInfo)
    }
  }

  return categories
}

/**
 * Generate markdown sitemap
 */
function generateSitemap(categories) {
  let sitemap = `# Documentation Sitemap

Generated on ${new Date().toISOString().split('T')[0]}

## Overview

This sitemap provides a comprehensive index of all documentation in the repository, organized by category and including metadata about ownership, status, and last review dates.

`

  for (const [category, docs] of Object.entries(categories)) {
    if (docs.length === 0) continue

    sitemap += `## ${category}\n\n`

    for (const doc of docs) {
      const statusIcon =
        doc.status === 'active'
          ? '✅'
          : doc.status === 'draft'
          ? '📝'
          : doc.status === 'deprecated'
          ? '⚠️'
          : '❓'

      sitemap += `### ${statusIcon} [${doc.title}](${doc.path})\n`
      sitemap += `- **Status**: ${doc.status}\n`
      sitemap += `- **Owner**: ${doc.owner}\n`
      sitemap += `- **Last Reviewed**: ${doc.lastReviewed}\n`
      if (doc.tags.length > 0) {
        sitemap += `- **Tags**: ${doc.tags.join(', ')}\n`
      }
      sitemap += '\n'
    }

    sitemap += '\n'
  }

  return sitemap
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning documentation files...')

  // Find all markdown files
  const markdownFiles = await glob('**/*.md', {
    cwd: rootDir,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
    ],
  })

  console.log(`📄 Found ${markdownFiles.length} markdown files`)

  // Categorize docs
  const categories = categorizeDocs(markdownFiles.map((path) => ({ path })))

  // Generate sitemap
  const sitemap = generateSitemap(categories)

  // Write sitemap
  const sitemapPath = join(rootDir, 'docs', 'SITEMAP.md')
  writeFileSync(sitemapPath, sitemap)

  console.log(`✅ Generated sitemap: ${relative(rootDir, sitemapPath)}`)

  // Print summary
  console.log('\n📊 Summary:')
  for (const [category, docs] of Object.entries(categories)) {
    if (docs.length > 0) {
      console.log(`  ${category}: ${docs.length} files`)
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed to generate sitemap:', err.message)
  process.exit(1)
})
