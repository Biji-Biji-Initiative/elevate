import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

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
    '@elevate/emails',
    '@elevate/storage',
    '@elevate/integrations',
  ],
  images: {
    domains: ['img.clerk.com', 'images.clerk.dev'],
  },
  async rewrites() {
    return [
      {
        source: '/robots.txt',
        destination: '/api/robots'
      },
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap'
      }
    ];
  }
}

export default withNextIntl(nextConfig);
