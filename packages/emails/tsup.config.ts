import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    '@react-email/components',
    '@react-email/render',
    'resend'
  ],
})
