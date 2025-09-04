import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
  },
  format: ['esm', 'cjs'],
  target: 'node18',
  clean: true,
  dts: false, // Disable tsup's type generation, we'll use tsc directly
  splitting: false,
  sourcemap: true,
  minify: false,
  external: ['pino', 'pino-pretty', '@sentry/node'],
  outDir: 'dist',
  // Build types separately using tsc after bundling
  onSuccess: 'tsc --project tsconfig.build.json --emitDeclarationOnly',
})