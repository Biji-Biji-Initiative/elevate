import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root warning
  outputFileTracingRoot: '/Users/agent-g/elevate/elevate',
  
  // React 19 and Next.js 15 configuration
  experimental: {
    reactCompiler: false, // Disable React Compiler for now
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
