#!/usr/bin/env node
import { writeFileSync } from 'fs'

import { glob } from 'glob'

const archivedDocs = await glob('archive/docs-legacy/**/*.md')
const archivedPkgs = await glob('archive/packages-legacy/**/*.md')

function guessTarget(file) {
  const f = file.toLowerCase()
  if (f.includes('/leaps/')) return 'docs/leaps/README.md'
  if (f.endsWith('routes.md')) return 'docs/api/index.md'
  if (f.endsWith('errors-and-openapi.md')) return 'docs/api/index.md'
  if (f.endsWith('dev_troubleshooting.md') || f.endsWith('troubleshooting.md'))
    return 'docs/development.md'
  if (f.includes('/db/')) return 'docs/DATABASE.md'
  if (f.includes('logging')) return 'docs/LOGGING.md'
  if (f.includes('security')) return 'docs/security/index.md'
  if (f.includes('build') || f.includes('changesets')) return 'docs/BUILDING.md'
  return 'docs/README.md'
}

const header = `# Archive Mapping\n\nThis file maps archived documents to their canonical replacements.\n\n- Status: generated\n- Do not edit manually; run: \`pnpm run docs:archive-map\`\n`

function row(path) {
  const target = guessTarget(path)
  return `- ${path} -> ${target}`
}

const lines = [
  header,
  '\n## Archived Docs',
  ...archivedDocs.map(row),
  '\n## Archived Package Docs',
  ...archivedPkgs.map(row),
  '',
]
writeFileSync('docs/ARCHIVE_MAPPING.md', lines.join('\n'))
console.log('✅ Generated docs/ARCHIVE_MAPPING.md')
