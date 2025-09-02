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

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Add custom webpack configuration if needed
    return config;
  },
}

export default nextConfig;