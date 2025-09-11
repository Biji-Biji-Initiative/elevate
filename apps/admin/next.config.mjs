import path from 'path'
import { fileURLToPath } from 'url'

import bundleAnalyzer from '@next/bundle-analyzer'
import createNextIntlPlugin from 'next-intl/plugin'

import { getSecurityHeaders } from '@elevate/config/next'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const withNextIntl = createNextIntlPlugin('./i18n.ts')
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})
const repoRoot = path.join(__dirname, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove X-Powered-By header for security
  poweredByHeader: false,

  // Ensure Next.js treats the monorepo root correctly to avoid picking parent lockfiles/configs
  outputFileTracingRoot: repoRoot,

  // React 19 and Next.js 15 configuration with Turbopack
  experimental: {
    reactCompiler: false, // Disable React Compiler for now
    // Additional build optimizations
    esmExternals: true,
    // Development optimizations
    optimizePackageImports: [
      '@elevate/ui',
      '@elevate/types',
      '@elevate/auth',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'lucide-react',
    ],
  },

  // Build optimizations
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  // Turbopack configuration: rely on package entrypoints only
  turbopack: {
    // Must match outputFileTracingRoot
    root: repoRoot,
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },

  // Transpile internal packages with React
  transpilePackages: [
    '@elevate/ui',
    '@elevate/auth',
    '@elevate/emails',
    '@elevate/types',
    '@elevate/db',
    '@elevate/storage',
    '@elevate/security',
    '@elevate/integrations',
    '@elevate/logic',
    '@elevate/config',
  ],

  // ESLint configuration
  eslint: {
    // Use the root ESLint config
    dirs: ['./'],
  },

  // TypeScript configuration
  typescript: {
    // Enable type checking in development
    tsconfigPath: './tsconfig.json',
  },

  // Image configuration
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  // Security headers configuration - comprehensive security posture
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    return getSecurityHeaders({ isProduction })
  },

  // Webpack configuration for optimized bundle splitting
  webpack: (config, { isServer }) => {
    // Add resolution for .ts files in openapi dist
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.ts': ['.ts', '.js'],
    }

    // Optimize chunk splitting for i18n
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Separate chunk for each locale
            'locale-en': {
              test: /[\\/]messages[\\/]en\.json$/,
              name: 'locale-en',
              chunks: 'all',
              priority: 30,
            },
            'locale-id': {
              test: /[\\/]messages[\\/]id\.json$/,
              name: 'locale-id',
              chunks: 'all',
              priority: 30,
            },
            // next-intl library
            'next-intl': {
              test: /[\\/]node_modules[\\/]next-intl[\\/]/,
              name: 'next-intl',
              chunks: 'all',
              priority: 25,
            },
          },
        },
      }
    }

    return config
  },
}

export default withNextIntl(withBundleAnalyzer(nextConfig))
