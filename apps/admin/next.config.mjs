import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import { getSecurityHeaders } from '@elevate/config/next'

const withNextIntl = createNextIntlPlugin('./i18n.ts');
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove X-Powered-By header for security
  poweredByHeader: false,
  
  // React 19 and Next.js 15 configuration with Turbopack
  experimental: {
    reactCompiler: false, // Disable React Compiler for now
    // Enable Turbopack for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
      resolveAlias: {
        // Optimize package resolution for faster builds
        '@elevate/ui': './packages/ui/src',
        '@elevate/types': './packages/types/src',
        '@elevate/auth': './packages/auth/src',
        '@elevate/db': './packages/db/src',
        '@elevate/storage': './packages/storage/src',
        '@elevate/logic': './packages/logic/src',
        '@elevate/config': './packages/config/src',
        '@elevate/security': './packages/security/src',
        '@elevate/integrations': './packages/integrations/src',
      },
      memoryLimit: 4096,
      // Enable faster development builds  
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
      loaders: {
        '.ts': 'tsx',
        '.tsx': 'tsx'
      },
    },
    // Additional build optimizations
    esmExternals: true,
    serverExternalPackages: ['@prisma/client', 'bcryptjs'],
    // Optimize builds with caching
    outputFileTracing: true,
    // Development optimizations
    optimizePackageImports: [
      '@elevate/ui',
      '@elevate/types',
      '@elevate/auth',
      '@elevate/admin-core',
      '@radix-ui/react-dialog', 
      '@radix-ui/react-select',
      'lucide-react'
    ],
  },

  // Transpile internal packages with React
  transpilePackages: [
    '@elevate/ui',
    '@elevate/auth',
    '@elevate/emails',
    '@elevate/types',
    '@elevate/db',
    '@elevate/storage',
    '@elevate/openapi',
    '@elevate/security',
    '@elevate/integrations',
    '@elevate/logic',
    '@elevate/config'
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

  // SWC minification
  swcMinify: true,

  // Image configuration
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' }
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
      ".ts": [".ts", ".js"],
    };
    
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
      };
    }
    
    return config;
  },
}

export default withNextIntl(withBundleAnalyzer(nextConfig));
