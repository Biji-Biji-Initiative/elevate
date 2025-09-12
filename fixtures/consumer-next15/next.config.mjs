import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    esmExternals: true,
  },
  // Ensure correct monorepo root for file tracing when multiple lockfiles exist
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
