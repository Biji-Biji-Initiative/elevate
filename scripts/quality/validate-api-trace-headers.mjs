#!/usr/bin/env node
import fs from 'fs'

import { glob } from 'glob'

const files = await glob('apps/admin/app/api/**/route.{ts,tsx,js,mjs}', { withFileTypes: false, nodir: true, ignore: ['**/node_modules/**'] })
let failures = 0

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const hasWrapper = src.includes('withApiErrorHandling(')
  const hasTraceImport = src.includes("from '@elevate/http'") && src.includes('TRACE_HEADER')
  const setsHeader = src.includes('headers.set(TRACE_HEADER')
  const bindsLogger = src.includes("createRequestLogger(")

  // Require either wrapper or explicit TRACE_HEADER set on responses
  if (!hasWrapper && !(hasTraceImport && setsHeader)) {
    console.error(`[trace-check] ${file}: missing withApiErrorHandling wrapper or TRACE_HEADER response setting`)
    failures++
  }
  // Encourage request-bound logging for correlation
  if (!bindsLogger) {
    console.warn(`[trace-check] ${file}: consider using createRequestLogger(baseLogger, request) for trace-bound logs`)
  }
}

if (failures > 0) {
  console.error(`\ntrace-check failed: ${failures} file(s) need updates.`)
  process.exit(1)
} else {
  console.log('trace-check passed: all admin API routes have trace handling.')
}
