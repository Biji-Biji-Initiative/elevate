import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';

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
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'lucide-react'
    ],
    // Enable faster builds with SWC (moved from forceSwcTransforms which is deprecated)
    // swcTraceProfiling is deprecated and removed
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
      // Supabase storage bucket CDN
      { protocol: 'https', hostname: '**.supabase.co' },
      // Clerk assets
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      // Common CDNs (tighten over time as needed)
      { protocol: 'https', hostname: 'res.cloudinary.com' }
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
      // Redirect API profile route if accessed directly (should only be used internally)
      {
        source: '/api/profile/:handle',
        destination: '/u/:handle',
        permanent: true,
      }
    ]
  },

  // Security headers configuration - comprehensive security posture
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return [
      {
        source: '/(.*)',
        headers: [
          // Core security headers - CSP is handled by middleware for dynamic nonce support
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Enhanced Permissions Policy - restrict powerful browser features
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'interest-cohort=()',
              'payment=()',
              'sync-xhr=()',
              'usb=()',
              'magnetometer=()',
              'accelerometer=()',
              'gyroscope=()',
              'bluetooth=()',
              'midi=()',
              'notifications=()',
              'push=()',
              'speaker-selection=()',
              'ambient-light-sensor=()',
              'battery=()',
              'display-capture=()',
              'document-domain=()',
              'execution-while-not-rendered=()',
              'execution-while-out-of-viewport=()',
              'fullscreen=(self)',
              'gamepad=()',
              'hid=()',
              'idle-detection=()',
              'local-fonts=()',
              'serial=()',
              'storage-access=()',
              'window-management=()',
              'xr-spatial-tracking=()'
            ].join(', '),
          },
          // HSTS for production - force HTTPS and include subdomains
          ...(isProduction ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ] : []),
          // Additional security headers
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
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
      };
    }
    
    return config;
  },
}

export default withNextIntl(withBundleAnalyzer(nextConfig));
