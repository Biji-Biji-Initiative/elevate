#!/usr/bin/env node
// ESM script to enforce docs↔code parity for key counts
import { readFileSync, existsSync } from 'fs'

import { glob } from 'glob'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function getPackageScriptCount() {
  const pkg = readJson('package.json')
  return Object.keys(pkg.scripts || {}).length
}

function getDocsScriptCount() {
  const text = readFileSync('docs/development.md', 'utf8')
  const m = text.match(/# Development \((\d+) total scripts available\)/)
  return m ? Number(m[1]) : null
}

async function getApiRouteCounts() {
  // Prefer precomputed inventory; fallback to globbing source
  let web = 0,
    admin = 0
  if (existsSync('reports/api-inventory.json')) {
    try {
      const inv = readJson('reports/api-inventory.json')
      const onlySrc = (arr, prefix) =>
        (arr || []).filter((x) => (x.path || '').includes(prefix)).length
      web = onlySrc(inv.web || [], 'apps/web/app/api/')
      admin = onlySrc(inv.admin || [], 'apps/admin/app/api/')
    } catch {}
  }
  if (!web || !admin) {
    const webFiles = await glob(['apps/web/app/api/**/route.{ts,js}'], {
      ignore: ['**/.next/**'],
    })
    const adminFiles = await glob(['apps/admin/app/api/**/route.{ts,js}'], {
      ignore: ['**/.next/**'],
    })
    web = web || webFiles.length
    admin = admin || adminFiles.length
  }
  return { web, admin }
}

function getDocsApiCounts() {
  const text = readFileSync('docs/api/index.md', 'utf8')
  const webM = text.match(/Web App API\`.*\((\d+) routes\)/)
  const adminM = text.match(/Admin App API\`.*\((\d+) routes\)/)
  // Alternative headings
  const webH = text.match(/#### Web App Routes \((\d+) total\)/)
  const adminH = text.match(/#### Admin App Routes \((\d+) total\)/)
  return {
    web: webM ? Number(webM[1]) : webH ? Number(webH[1]) : null,
    admin: adminM ? Number(adminM[1]) : adminH ? Number(adminH[1]) : null,
  }
}

function countPrismaModels() {
  const text = readFileSync('packages/db/schema.prisma', 'utf8')
  const matches = text.match(/^model\s+\w+\s*\{/gm) || []
  return matches.length
}

function getDocsModelCount() {
  const text = readFileSync('docs/DATABASE.md', 'utf8')
  const patterns = [
    /Models:\s*(\d+)\s+core models/,
    /\*\*Models\*\*:\s*(\d+)\s+core models/,
    /-\s+\*\*Models\*\*:\s*(\d+)\s+core models/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return Number(m[1])
  }
  return null
}

function fail(msg) {
  console.error(`\u274c ${msg}`)
  process.exitCode = 1
}

;(async function main() {
  console.log('\u2139\ufe0f Checking docs↔code parity...')

  // Scripts count parity
  const pkgScripts = getPackageScriptCount()
  const docsScripts = getDocsScriptCount()
  if (docsScripts == null)
    fail('Could not parse scripts count in docs/development.md')
  else if (pkgScripts !== docsScripts)
    fail(
      `Scripts count mismatch: package.json=${pkgScripts} vs docs=${docsScripts}`,
    )

  // API route counts parity
  const { web, admin } = await getApiRouteCounts()
  const docsApi = getDocsApiCounts()
  if (docsApi.web == null || docsApi.admin == null)
    fail('Could not parse API counts in docs/api/index.md')
  else {
    if (web !== docsApi.web)
      fail(`Web routes mismatch: code=${web} vs docs=${docsApi.web}`)
    if (admin !== docsApi.admin)
      fail(`Admin routes mismatch: code=${admin} vs docs=${docsApi.admin}`)
  }

  // Prisma models count parity
  const prismaModels = countPrismaModels()
  const docsModels = getDocsModelCount()
  if (docsModels == null)
    fail('Could not parse model count in docs/DATABASE.md')
  else if (prismaModels !== docsModels)
    fail(`DB models mismatch: prisma=${prismaModels} vs docs=${docsModels}`)

  if (process.exitCode) {
    console.error(
      '\nSummary: Parity failures detected. Update docs to match the codebase.',
    )
    process.exit(process.exitCode)
  }
  console.log('\u2705 Parity OK: docs reflect current codebase.')
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
