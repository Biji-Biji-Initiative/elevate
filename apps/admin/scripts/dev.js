#!/usr/bin/env node
/*
 * Simple dev launcher that picks an available port starting from ADMIN_PORT/PORT/3001
 * and forwards any extra CLI args (e.g., --turbo) to `next dev`.
 */

const { spawn } = require('child_process')
const net = require('net')

const argv = process.argv.slice(2)

const envPort = parseInt(process.env.ADMIN_PORT || process.env.PORT || '', 10)
const base = Number.isFinite(envPort) ? envPort : 3001
const max = base + 20

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => {
      srv.close(() => resolve(true))
    })
    srv.listen(port, '0.0.0.0')
  })
}

async function pickPort() {
  for (let p = base; p <= max; p++) {
    if (await isPortFree(p)) return p
  }
  throw new Error(`No free port found in range ${base}-${max}`)
}

async function main() {
  const port = await pickPort()
  const child = spawn('next', ['dev', '-p', String(port), ...argv], {
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
