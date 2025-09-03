import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/context.tsx', 'src/server-helpers.ts', 'src/withRole.ts', 'src/types.ts'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'next',
    '@clerk/nextjs'
  ],
})
