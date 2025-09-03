import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'spec': 'src/spec.ts',
    'sdk': 'src/simple-sdk.ts'
  },
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    '@asteasolutions/zod-to-openapi',
    'zod'
  ],
})
