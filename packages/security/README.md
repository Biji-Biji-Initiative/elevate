# @elevate/security

Comprehensive security package for the MS Elevate LEAPS Tracker, providing Content Security Policy (CSP), security headers, CSRF protection, and rate limiting.

## Features

- **Content Security Policy (CSP)** with dynamic nonce generation
- **Security Headers** including HSTS, X-Frame-Options, and more
- **CSRF Protection** for state-changing operations
- **Rate Limiting** with Redis support
- **Environment-aware Configuration** for development, staging, and production
- **CSP Violation Reporting** and analysis
- **React Hooks** for CSP integration in components

## Installation

```bash
pnpm add @elevate/security
```

## Quick Start

### Basic Security Middleware

```typescript
// middleware.ts
import { createSecurityMiddleware, getSecurityConfig } from '@elevate/security/security-middleware';

const securityConfig = getSecurityConfig();
const securityMiddleware = createSecurityMiddleware(securityConfig);

export default securityMiddleware;
```

### Next.js Integration

```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Other security headers...
        ],
      },
    ];
  },
};
```

### React Components with CSP

```tsx
// components/MyComponent.tsx
import { useCSPNonce, CSPScript } from '@elevate/security/csp-hooks';

function MyComponent() {
  const nonce = useCSPNonce();
  
  return (
    <div>
      <CSPScript>
        {`console.log('This script will have the correct nonce');`}
      </CSPScript>
    </div>
  );
}
```

## API Reference

### Core CSP Functions

#### `generateNonce()`

Generates a cryptographically secure nonce for CSP.

```typescript
import { generateNonce } from '@elevate/security/csp';

const nonce = generateNonce();
// Returns: base64-encoded random string
```

#### `buildCSPDirectives(options)`

Builds Content Security Policy directives string.

```typescript
import { buildCSPDirectives } from '@elevate/security/csp';

const csp = buildCSPDirectives({
  nonce: 'abc123',
  isDevelopment: false,
  allowedDomains: {
    external: ['https://api.example.com']
  }
});
```

**Options:**
- `nonce?: string` - CSP nonce for inline scripts
- `isDevelopment?: boolean` - Enable development-specific directives
- `allowedDomains?: object` - Custom allowed domains
  - `clerk?: string[]` - Additional Clerk domains
  - `supabase?: string[]` - Additional Supabase domains
  - `fonts?: string[]` - Additional font domains
  - `images?: string[]` - Additional image domains
  - `analytics?: string[]` - Additional analytics domains
  - `external?: string[]` - Additional external domains

#### `generateSecurityHeaders(options)`

Generates all security headers including CSP.

```typescript
import { generateSecurityHeaders } from '@elevate/security/csp';

const headers = generateSecurityHeaders({
  reportOnly: true,
  reportUri: '/api/csp-report'
});
```

### Security Middleware

#### `createSecurityMiddleware(options)`

Creates Next.js middleware with security headers.

```typescript
import { createSecurityMiddleware } from '@elevate/security/security-middleware';

const middleware = createSecurityMiddleware({
  skipPaths: ['/api/health'],
  reportUri: '/api/csp-report',
  enableReporting: true
});
```

**Options:**
- `skipPaths?: (string | RegExp)[]` - Paths to skip security headers
- `headerOverrides?: Record<string, string>` - Override specific headers
- `enableReporting?: boolean` - Enable CSP reporting
- `reportUri?: string` - CSP violation report endpoint
- `isDevelopment?: boolean` - Development mode
- `logViolations?: boolean` - Log violations to console

#### `withSecurity(middleware, options)`

Combines security middleware with existing middleware.

```typescript
import { withSecurity } from '@elevate/security/security-middleware';
import { clerkMiddleware } from '@clerk/nextjs/server';

const securedMiddleware = withSecurity(clerkMiddleware, {
  enableReporting: true
});

export default securedMiddleware;
```

### CSP Violation Reporting

#### `createCSPReportHandler(options)`

Creates a handler for CSP violation reports.

```typescript
import { createCSPReportHandler } from '@elevate/security/security-middleware';

const reportHandler = createCSPReportHandler({
  logToConsole: true,
  alertOnSeverity: 'high',
  onViolation: (violation) => {
    // Custom violation handling
    console.error('CSP Violation:', violation);
  }
});

// In your API route
export const POST = reportHandler;
```

### React Hooks and Components

#### `useCSPNonce()`

Hook to get the current CSP nonce.

```tsx
import { useCSPNonce } from '@elevate/security/csp-hooks';

function MyComponent() {
  const nonce = useCSPNonce();
  // Use nonce for inline scripts or styles
}
```

#### `<CSPScript>`

Component for CSP-compliant inline scripts.

```tsx
import { CSPScript } from '@elevate/security/csp-hooks';

function MyComponent() {
  return (
    <CSPScript>
      {`
        // This script will automatically get the correct nonce
        console.log('Hello from CSP script');
      `}
    </CSPScript>
  );
}
```

**Props:**
- `children: string` - Script content
- `id?: string` - Script ID
- `type?: string` - Script type (default: 'text/javascript')
- `defer?: boolean` - Defer script execution
- `async?: boolean` - Async script loading

#### `<CSPStyle>`

Component for CSP-compliant inline styles.

```tsx
import { CSPStyle } from '@elevate/security/csp-hooks';

function MyComponent() {
  return (
    <CSPStyle>
      {`
        .my-class {
          color: red;
        }
      `}
    </CSPStyle>
  );
}
```

#### `<NonceProvider>`

Provider component to make nonce available to child components.

```tsx
import { NonceProvider } from '@elevate/security/csp-hooks';

function App({ nonce }: { nonce: string }) {
  return (
    <NonceProvider nonce={nonce}>
      <MyComponent />
    </NonceProvider>
  );
}
```

### Environment Configuration

#### `getSecurityConfig(environment)`

Get predefined security configuration for an environment.

```typescript
import { getSecurityConfig } from '@elevate/security/security-middleware';

// Get config for current environment
const config = getSecurityConfig();

// Get config for specific environment
const prodConfig = getSecurityConfig('production');
const devConfig = getSecurityConfig('development');
const stagingConfig = getSecurityConfig('staging');
```

**Environments:**
- `development` - Report-only mode, relaxed policies
- `staging` - Enforcing mode with reporting enabled
- `production` - Strict policies, HSTS enabled

## Configuration Examples

### Development Configuration

```typescript
const devConfig = {
  reportOnly: true,
  isDevelopment: true,
  enableReporting: false,
  logViolations: true,
  allowedDomains: {
    external: [
      'http://localhost:3000',
      'http://localhost:3001',
      'ws://localhost:*'
    ]
  }
};
```

### Production Configuration

```typescript
const prodConfig = {
  reportOnly: false,
  isDevelopment: false,
  enableReporting: true,
  reportUri: '/api/csp-report',
  logViolations: false,
  allowedDomains: {
    external: [] // No additional external domains
  }
};
```

### Custom Domain Configuration

```typescript
const customConfig = {
  allowedDomains: {
    clerk: ['https://custom-clerk.example.com'],
    supabase: ['https://custom-supabase.example.com'],
    fonts: ['https://fonts.example.com'],
    images: ['https://images.example.com'],
    analytics: ['https://analytics.example.com'],
    external: [
      'https://api.example.com',
      'https://cdn.example.com'
    ]
  }
};
```

## CSP Directives Explained

The package generates comprehensive CSP directives:

### `default-src 'self'`
- Restricts all resource loading to same origin by default

### `script-src`
- Allows scripts from self, with nonce for inline scripts
- Includes Clerk, Vercel, and development-specific sources
- Uses `'unsafe-eval'` in development for Next.js

### `style-src`
- Allows styles from self and `'unsafe-inline'` for CSS-in-JS
- Includes font providers and Clerk domains

### `img-src`
- Comprehensive image sources including data URLs, Supabase, Clerk
- Supports blob URLs for dynamic images

### `connect-src`
- API endpoints, WebSocket connections
- Includes Clerk, Supabase, analytics services
- Development localhost connections

### `frame-src`
- Restricted to Clerk and essential services
- Prevents most iframe embedding

### `object-src 'none'`
- Blocks plugins and embedded objects

### `frame-ancestors 'none'`
- Prevents clickjacking attacks

## Security Headers Reference

### Content Security Policy
- Dynamic CSP with nonce support
- Environment-aware policies
- Violation reporting

### X-Frame-Options: DENY
- Prevents clickjacking attacks
- Blocks all iframe embedding

### X-Content-Type-Options: nosniff
- Prevents MIME type sniffing attacks

### Referrer-Policy: strict-origin-when-cross-origin
- Controls referrer information leakage

### Strict-Transport-Security (Production)
- Forces HTTPS connections
- Includes subdomains and preload

### X-XSS-Protection: 1; mode=block
- Legacy XSS protection for older browsers

### Permissions-Policy
- Restricts powerful web platform features
- Blocks camera, microphone, geolocation, etc.

## Troubleshooting

### Common CSP Violations

#### Inline Script Blocked
```
Refused to execute inline script because it violates CSP directive: 'script-src'
```

**Solution:** Use the `CSPScript` component or add nonce to script tags.

#### External Resource Blocked
```
Refused to load resource because it violates CSP directive: 'img-src'
```

**Solution:** Add the domain to `allowedDomains.images` or appropriate category.

#### Font Loading Issues
```
Refused to load font because it violates CSP directive: 'font-src'
```

**Solution:** Ensure font domains are in `allowedDomains.fonts`.

### Development Debugging

Enable CSP violation logging:

```typescript
const config = {
  logViolations: true,
  reportOnly: true // Use report-only mode during development
};
```

### Testing CSP Policies

Test your CSP policies:

```bash
# Test with curl
curl -H "Content-Type: application/csp-report" \
     -d '{"csp-report":{"document-uri":"test"}}' \
     http://localhost:3000/api/csp-report
```

## Migration Guide

### From No CSP to CSP

1. **Start with Report-Only Mode**
   ```typescript
   const config = { reportOnly: true };
   ```

2. **Monitor Violations**
   - Check console logs and CSP reports
   - Identify blocked resources

3. **Add Required Domains**
   ```typescript
   const config = {
     allowedDomains: {
       external: ['https://required-domain.com']
     }
   };
   ```

4. **Enable Enforcement**
   ```typescript
   const config = { reportOnly: false };
   ```

### Updating Existing Components

Replace inline scripts:

```tsx
// Before
<script>console.log('Hello');</script>

// After
<CSPScript>console.log('Hello');</CSPScript>
```

## Best Practices

### 1. Use Report-Only Mode First
Always test CSP policies in report-only mode before enforcement.

### 2. Monitor Violations
Set up proper logging and monitoring for CSP violations.

### 3. Minimize Inline Content
Avoid inline scripts and styles when possible.

### 4. Regular Policy Reviews
Review and update CSP policies as your application evolves.

### 5. Environment-Specific Configuration
Use different policies for development, staging, and production.

### 6. Gradual Rollout
Roll out CSP changes gradually to identify issues.

## Security Considerations

### 1. Nonce Rotation
Nonces are generated per request and should never be reused.

### 2. Report URI Security
CSP report endpoints can be targets for DoS attacks. Implement rate limiting.

### 3. Domain Validation
Carefully validate all domains added to CSP policies.

### 4. Development vs Production
Never use development CSP policies in production.

### 5. Third-Party Scripts
Audit all third-party scripts and minimize their usage.

## Contributing

When adding new features or modifying CSP policies:

1. Update tests in `__tests__/`
2. Test in all environments
3. Update documentation
4. Consider backward compatibility
5. Add appropriate TypeScript types

## License

Private package for MS Elevate LEAPS Tracker project.
## Client vs Server Imports

This package exposes both server-only helpers (which depend on `next/headers` and `next/server`) and client-safe constants. To maintain clear boundaries and avoid bundling server APIs into client components:

- In client components (files with `"use client"`), only import from subpaths that are client-safe:
  - `@elevate/security/constants` — provides `CSRF_TOKEN_HEADER`, `CSRF_COOKIE_NAME` for client requests.

- In server route handlers or server components, import from the root or server subpaths:
  - `@elevate/security` — general helpers like `withRateLimit`, `publicApiRateLimiter`, etc.
  - `@elevate/security/csrf` — CSRF managers and middleware using `next/headers`.
  - `@elevate/security/security-middleware` — CSP, headers, and report handlers.

The repo’s ESLint config enforces this boundary: root `@elevate/security` is disallowed in client components, while API routes are permitted to import server-only helpers.
