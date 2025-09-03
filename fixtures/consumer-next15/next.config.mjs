/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@elevate/auth',
    '@elevate/config', 
    '@elevate/db',
    '@elevate/emails',
    '@elevate/integrations',
    '@elevate/logic',
    '@elevate/openapi',
    '@elevate/security',
    '@elevate/storage',
    '@elevate/types',
    '@elevate/ui'
  ],
  experimental: {
    esmExternals: true
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;