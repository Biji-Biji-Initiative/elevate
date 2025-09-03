import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/schemas.ts', 'src/query-schemas.ts'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['zod'],
})
