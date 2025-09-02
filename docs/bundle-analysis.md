# Bundle Analysis Guide - i18n Optimization

This guide explains how to analyze and optimize bundle splitting for internationalization in the MS Elevate LEAPS Tracker project.

## Overview

The project is optimized to ensure:
- English users only download English translations
- Indonesian users only download Indonesian translations  
- Common i18n code (next-intl library) is shared efficiently
- No locale leakage into main application bundles

## Quick Start

### Run Bundle Analysis

```bash
# Analyze bundle splitting for both apps
pnpm analyze:bundles

# Build with visual bundle analyzer
pnpm build:analyze

# Individual app analysis
cd apps/web && pnpm analyze:bundle
cd apps/admin && pnpm analyze:bundle
```

### Visual Bundle Analysis

The visual bundle analyzer will automatically open in your browser when you run:

```bash
# For web app
cd apps/web && pnpm build:analyze

# For admin app  
cd apps/admin && pnpm build:analyze
```

## How Bundle Splitting Works

### Webpack Configuration

Both apps use custom webpack configuration to create separate chunks for:

1. **Locale Chunks**: Each locale gets its own chunk
   - `locale-en`: English translations
   - `locale-id`: Indonesian translations

2. **Library Chunk**: next-intl library code
   - `next-intl`: Shared i18n functionality

### Dynamic Imports

The i18n configuration uses explicit dynamic imports instead of template literals to ensure proper code splitting:

```typescript
// Optimized approach
const loadMessages = async (locale: string) => {
  switch (locale) {
    case 'en':
      return (await import('./messages/en.json')).default;
    case 'id':  
      return (await import('./messages/id.json')).default;
    default:
      throw new Error(`Unsupported locale: ${locale}`);
  }
};
```

## Bundle Analysis Script

The custom analysis script (`scripts/analyze-bundles.js`) performs the following checks:

### 1. Chunk Detection
- Identifies locale-specific chunks
- Verifies next-intl library separation
- Reports chunk sizes

### 2. Leakage Detection  
- Scans main chunks for locale content
- Identifies any translations that leaked into common bundles
- Provides specific examples of leaked content

### 3. Size Reporting
- Reports individual chunk sizes
- Compares locale bundle sizes
- Identifies optimization opportunities

## Expected Bundle Structure

### Optimal Chunk Distribution

```
📦 Web App Chunks:
├── locale-en.{hash}.js        # English translations only
├── locale-id.{hash}.js        # Indonesian translations only  
├── next-intl.{hash}.js        # i18n library code
├── main.{hash}.js             # Application logic (no translations)
├── framework.{hash}.js        # React/Next.js code
└── vendor.{hash}.js           # Other third-party libraries
```

### Size Targets

| Chunk Type | Target Size | Description |
|------------|-------------|-------------|
| locale-en | < 10KB | English translations |
| locale-id | < 12KB | Indonesian translations (typically larger) |
| next-intl | < 15KB | i18n library code |

## Troubleshooting Bundle Issues

### Problem: Locale Leakage

**Symptoms:**
- Translations found in main/vendor chunks
- Larger than expected main bundle size
- Both locales loading for single-language users

**Solutions:**
1. Check dynamic import syntax in `i18n.ts`
2. Verify webpack cacheGroups configuration  
3. Ensure no direct imports of translation files

### Problem: No Locale Chunks

**Symptoms:**
- No `locale-*` chunks in build output
- Single large bundle containing all translations

**Solutions:**
1. Verify webpack configuration is applied correctly
2. Check that dynamic imports are being used
3. Ensure build is using production mode

### Problem: Duplicate Library Code

**Symptoms:**
- next-intl code in multiple chunks
- Larger total bundle size

**Solutions:**
1. Adjust webpack splitChunks configuration
2. Review chunk priorities
3. Check for multiple next-intl imports

## Performance Monitoring

### Core Web Vitals Impact

Monitor the following metrics to ensure i18n optimization is working:

1. **First Contentful Paint (FCP)**: Should not increase significantly
2. **Largest Contentful Paint (LCP)**: May improve with smaller initial bundles
3. **Total Blocking Time (TBT)**: Should remain stable or improve

### Bundle Size Monitoring

Set up monitoring for:
- Total JavaScript bundle size per locale
- Individual chunk sizes
- Cache hit rates for locale chunks

## CI/CD Integration

### Automated Bundle Analysis

Add bundle analysis to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Analyze Bundle Splitting
  run: |
    pnpm build
    pnpm analyze:bundles
    
- name: Check Bundle Size Limits
  run: |
    # Add size limit checks here
    bundlewatch
```

### Bundle Size Budget

Consider setting bundle size budgets:

```json
{
  "bundlewatch": {
    "files": [
      {
        "path": "apps/web/.next/static/chunks/locale-en*.js",
        "maxSize": "10kb"
      },
      {
        "path": "apps/web/.next/static/chunks/locale-id*.js", 
        "maxSize": "12kb"
      }
    ]
  }
}
```

## Advanced Optimization Techniques

### 1. Lazy Locale Loading

For even better performance, implement lazy locale switching:

```typescript
// Example: Lazy locale switching
const switchLocale = async (newLocale: string) => {
  // Dynamically import new locale
  const messages = await loadMessages(newLocale);
  // Update i18n context
  updateMessages(messages);
};
```

### 2. Message Tree Shaking

Optimize by removing unused translation keys:

```bash
# Install i18n tree shaking tools
pnpm add -D babel-plugin-transform-inline-environment-variables
```

### 3. Compression Optimization

Ensure proper compression for locale chunks:

```javascript
// next.config.mjs compression example
experimental: {
  optimizePackageImports: ['next-intl'],
},
```

## Best Practices

### 1. Translation File Management

- Keep translation files under 10KB per locale
- Use consistent key structures across locales
- Remove unused translation keys regularly

### 2. Code Organization

- Import translations only through the i18n configuration
- Avoid direct imports of JSON translation files
- Use TypeScript for translation key validation

### 3. Testing

- Test bundle splitting in production builds
- Verify locale loading in different network conditions
- Monitor bundle sizes in automated tests

## Debugging Commands

### Webpack Bundle Analysis

```bash
# Generate detailed webpack stats
cd apps/web && npx webpack-bundle-analyzer .next/static/webpack/stats.json

# Check chunk dependencies  
cd apps/web && npx webpack --analyze
```

### Next.js Bundle Analysis

```bash
# Next.js built-in bundle analysis
cd apps/web && npx next info

# Check bundle composition
cd apps/web && npx next build --debug
```

## Resources

- [Next.js Bundle Analysis](https://nextjs.org/docs/advanced-features/analyzing-bundles)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Web Performance Best Practices](https://web.dev/performance/)

---

*Last updated: September 2025*