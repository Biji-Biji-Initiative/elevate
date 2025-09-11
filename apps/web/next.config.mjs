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

  // Ensure Next.js treats the monorepo root correctly for server tracing
  outputFileTracingRoot: repoRoot,

  // React 19 and Next.js 15 configuration with Turbopack
  experimental: {
    // Allow all hosts for Replit proxy compatibility
    allowedHosts: true,
    reactCompiler: false, // Disable React Compiler for now
    // Development optimizations
    optimizePackageImports: [
      '@elevate/ui',
      '@elevate/types',
      '@elevate/auth',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'lucide-react',
    ],
    // Enable faster builds with SWC (moved from forceSwcTransforms which is deprecated)
    // swcTraceProfiling is deprecated and removed
  },

  // Turbopack configuration: rely on package entrypoints only
  turbopack: {
    // Pin the Turbopack root to the monorepo root (must match outputFileTracingRoot)
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
    '@elevate/app-services',
  ],

  // ESLint configuration
  eslint: {
    // Use the root ESLint config
    dirs: ['./'],
  },

  // Build optimizations
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  // TypeScript configuration
  typescript: {
    // Enable type checking in development
    tsconfigPath: './tsconfig.json',
  },

  // Image configuration
  images: {
    remotePatterns: [
      // Supabase storage bucket CDN
      { protocol: 'https', hostname: '**.supabase.co' },
      // Clerk assets
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      // Common CDNs (tighten over time as needed)
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  // Redirects for canonical URLs
  redirects: async () => {
    return [
      // Redirect any potential legacy profile routes to canonical /u/[handle]
      {
        source: '/profile/:handle',
        destination: '/u/:handle',
        permanent: true, // 308 status code
      },
      {
        source: '/user/:handle',
        destination: '/u/:handle',
        permanent: true,
      },
      {
        source: '/profiles/:handle',
        destination: '/u/:handle',
        permanent: true,
      },
      // Do not redirect /api/profile to pages; profile JSON is served by an API route
    ]
  },

  // Security headers configuration - comprehensive security posture
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    const headers = getSecurityHeaders({ isProduction })
    
    // In development, add CORS headers for API routes to allow admin panel access
    if (!isProduction) {
      headers.push({
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3002' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      })
    }
    
    return headers
  },

  // Webpack configuration for optimized bundle splitting
  webpack: (config, { isServer }) => {
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
