/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
  },
  transpilePackages: [
    '@elevate/auth',
    '@elevate/db',
    '@elevate/config',
    '@elevate/types',
    '@elevate/logic',
    '@elevate/ui',
    '@elevate/emails',
    '@elevate/storage',
  ],
}
export default nextConfig
