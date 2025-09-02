import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for React 19
  experimental: {
    reactCompiler: false, // Disable React Compiler for now
  },
  
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
      {
        protocol: 'https',
        hostname: '**',
      },
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

export default withBundleAnalyzer(nextConfig);