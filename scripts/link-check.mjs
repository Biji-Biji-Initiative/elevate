#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from 'fs'
import { resolve, dirname, join, normalize } from 'path'

import { glob } from 'glob'

const files = await glob('**/*.md', {
  ignore: ['**/node_modules/**', '**/.git/**', '**/archive/**'],
})
const broken = []

for (const filePath of files) {
  if (filePath.endsWith('docs/SITEMAP.md')) continue // ignore generated sitemap links
  const content = readFileSync(filePath, 'utf8')
  const baseDir = dirname(filePath)
  const re = /\[[^\]]+\]\(([^\)]+)\)/g
  let m
  while ((m = re.exec(content))) {
    const raw = m[1]
    if (
      !raw ||
      raw.startsWith('http') ||
      raw.startsWith('mailto:') ||
      raw.startsWith('tel:')
    )
      continue
    if (raw.startsWith('#')) continue

    // strip anchors and query
    const href = raw.split('#')[0].split('?')[0]
    if (!href) continue

    // skip archived paths by policy
    if (href.startsWith('archive/')) continue
    if (href.includes('/temp/')) continue
    if (filePath.includes('/temp/')) continue
    // Skip benign package redirect stubs and archived stubs
    if (filePath.includes('packages/') && href.includes('docs/README.md'))
      continue
    if (
      filePath.includes('docs/architecture/adr/') &&
      href.includes('../README.md')
    )
      continue

    // compute absolute path; treat repo-root prefixes as root-based
    const rootPrefixes = [
      'docs/',
      'packages/',
      'apps/',
      'scripts/',
      'fixtures/',
      'reports/',
      'tests/',
      'AGENTS.md',
      'BUILDING.md',
      'VALIDATION_SYSTEMS.md',
      'SECRETS_MANAGEMENT.md',
      'ESLINT.md',
      'ENV_MANAGEMENT.md',
      'DEPLOYMENT_GUIDE.md',
      'VERCEL_DEPLOYMENT_GUIDE.md',
    ]
    const fromRoot = rootPrefixes.some((p) => href === p || href.startsWith(p))
    const abs = fromRoot
      ? resolve(process.cwd(), href)
      : href.startsWith('/')
      ? resolve(href)
      : resolve(baseDir, href)

    // Try variants: exact file, directory index (README.md)
    const candidates = [abs]
    if (!abs.endsWith('.md')) candidates.push(join(abs, 'README.md'))
    // If looks like a root file, try root directly
    if (!href.includes('/') && href.endsWith('.md'))
      candidates.push(resolve(process.cwd(), href))

    const exists = candidates.some((p) => {
      try {
        if (!existsSync(p)) return false
        const st = statSync(p)
        return st.isFile() || st.isDirectory()
      } catch {
        return false
      }
    })

    if (!exists) broken.push({ file: filePath, link: raw })
  }
}

console.log(JSON.stringify({ broken }, null, 2))
process.exit(0) // report-only
