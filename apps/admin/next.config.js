/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@elevate/auth',
    '@elevate/db',
    '@elevate/config',
    '@elevate/types',
    '@elevate/logic',
    '@elevate/ui',
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

module.exports = nextConfig