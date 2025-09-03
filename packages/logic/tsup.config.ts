import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/scoring.ts', 'src/badges.ts'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    '@elevate/db',
    '@elevate/types',
    'zod'
  ],
})
