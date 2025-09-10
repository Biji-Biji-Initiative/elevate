#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'

const docs = JSON.parse(readFileSync('reports/docs-inventory.json','utf8'))

const canonical = [
  'README.md',
  'docs/README.md',
  'docs/development.md',
  'docs/DEPLOYMENT.md',
  'docs/CONTRIBUTING.md',
  'docs/DATABASE.md',
  'docs/API.md',
  'docs/architecture/overview.md',
  'docs/onboarding.md',
  'docs/runbooks/deploy.md',
  'docs/security/index.md',
  'VALIDATION_SYSTEMS.md'
]

const exists = new Set(docs.map(d=>d.path))
const core = canonical.filter(p=>exists.has(p)).map(p=>({ path: p }))

writeFileSync('reports/core-docs-proposal.json', JSON.stringify(core, null, 2))

let md = '## Core Docs Proposal (<= 20)\n\n'
for (const c of core) md += `- ${c.path}\n`
md += '\nNotes:\n- Keep these as the canonical, high-signal set.\n- All other docs should either link into these or be archived with redirects.\n'
writeFileSync('reports/core-docs-map.md', md)

console.log('Core docs proposal written to reports/core-docs-proposal.json and reports/core-docs-map.md')
