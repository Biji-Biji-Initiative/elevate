/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client'],
  transpilePackages: [
    '@elevate/auth',
    '@elevate/db',
    '@elevate/config',
    '@elevate/types',
    '@elevate/logic',
    '@elevate/ui',
    '@elevate/integrations',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  // Admin-specific configuration
  basePath: '',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/queue',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
