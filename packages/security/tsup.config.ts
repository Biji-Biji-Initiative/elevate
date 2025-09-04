import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/csrf.ts',
    'src/rate-limiter.ts',
    'src/csp.ts',
    'src/security-middleware.ts',
    'src/csp-hooks.tsx',
    'src/sanitizer.ts',
  ],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['next'],
})
