import { defineConfig } from 'tsup'

/**
 * @typedef {string[] | Record<string, string>} Entry
 */

/**
 * @typedef {Object} BaseTsupOptions
 * @property {Entry} entry
 * @property {Array<string | RegExp>} [external]
 * @property {string} [outDir]
 */

/**
 * @param {BaseTsupOptions} options
 * @returns {import('tsup').Options}
 */
export function baseTsup(options) {
  const { entry, external = [], outDir = 'dist/js' } = options
  return defineConfig({
    entry,
    format: ['esm'],
    outDir,
    dts: false, // Types are handled by tsc in Stage 1
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    minify: false,
    target: 'es2022',
    platform: 'neutral',
    external: [
      /^@elevate\//,
      'react',
      'react-dom',
      'react/jsx-runtime',
      'next',
      'next/navigation',
      ...external
    ],
  })
}

/**
 * @param {BaseTsupOptions} options
 * @returns {import('tsup').Options}
 */
export function baseTsupClient(options) {
  const config = baseTsup(options)
  return defineConfig({
    ...config,
    // Client components configuration - base config for packages that need 'use client'
    // Individual packages should implement onSuccess to add 'use client' to their bundled files
  })
}

export default baseTsup
