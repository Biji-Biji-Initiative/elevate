#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'

const docs = JSON.parse(readFileSync('reports/docs-inventory.json','utf8'))

const coreSet = new Set([
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
])

function classify(d) {
  const p = d.path
  if (coreSet.has(p)) return { action: 'keep', reason: 'Core canonical doc' }
  if (p.startsWith('archive/')) return { action: 'archive', reason: 'Already archived' }
  if (p.includes('api-reports')) return { action: 'keep', reason: 'Generated API report' }
  if (p.endsWith('/README.md')) return { action: 'keep', reason: 'Package README' }
  if (p.startsWith('packages/')) return { action: 'keep', reason: 'Package-local doc' }
  if (p.startsWith('docs/')) return { action: 'merge', reason: 'Candidate to merge into core set' }
  return { action: 'merge', reason: 'Likely duplicate or out-of-scope; map to core' }
}

const matrix = docs.map(d=>({ path: d.path, title: d.title || '', owner: d.owner || '', status: d.status || '', action: classify(d).action, reason: classify(d).reason }))

writeFileSync('reports/decision-matrix.json', JSON.stringify(matrix, null, 2))
console.log('Decision matrix written: reports/decision-matrix.json')
