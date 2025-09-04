# UI Package Migration Guide

## Overview
The @elevate/ui package has been refactored to align with shadcn/ui standards and BUILDING.md specifications. This guide will help you migrate from the old structure to the new canonical structure.

## Key Changes

### 1. Directory Structure
The package has been reorganized into logical directories:

```
src/
├── components/ui/      # shadcn/ui primitives ONLY
├── blocks/            # Composite UI components
├── blocks/sections/   # Page sections
├── next/             # Next.js-specific components
├── feedback/         # Error boundaries
├── styles/           # Global CSS
└── lib/             # Utilities
```

### 2. No More Duplicates
All duplicate shadcn components have been removed. There is now a single source of truth in `components/ui/`.

### 3. Framework-Agnostic by Default
Components in `blocks/` are now framework-agnostic. Next.js-specific components are isolated in `next/`.

## Import Changes

### Before → After Migration

#### shadcn Primitives
```typescript
// BEFORE - Mixed locations
import { Button } from '@elevate/ui/components/button'
import { Badge } from '@elevate/ui/components/ui/badge'

// AFTER - All from root
import { Button, Badge, Card, Input, Label } from '@elevate/ui'
```

#### Block Components
```typescript
// BEFORE
import { DataTable } from '@elevate/ui/components/DataTable'
import { FileUpload } from '@elevate/ui/FileUpload'
import { LoadingSpinner } from '@elevate/ui/components/LoadingSpinner'

// AFTER
import { DataTable, FileUpload, LoadingSpinner } from '@elevate/ui/blocks'
```

#### Section Components
```typescript
// BEFORE
import { HeroSection } from '@elevate/ui/components/HeroSection'
import { FAQList } from '@elevate/ui/components/FAQList'

// AFTER
import { HeroSection, FAQList } from '@elevate/ui/blocks/sections'
```

#### Next.js Components
```typescript
// BEFORE
import { Header } from '@elevate/ui/components/Header'
import { AdminLayout } from '@elevate/ui/components/AdminLayout'

// AFTER
import { Header, AdminLayout } from '@elevate/ui/next'
```

#### Error Boundaries
```typescript
// BEFORE
import { ErrorBoundary } from '@elevate/ui/components/ErrorBoundary'
import { SentryErrorBoundary } from '@elevate/ui/components/SentryErrorBoundary'

// AFTER
import { ErrorBoundary } from '@elevate/ui/feedback'
import { SentryBoundary } from '@elevate/ui/feedback'  // Note: renamed
```

#### CSS Import
```typescript
// BEFORE
import '@elevate/ui/globals.css'

// AFTER
import '@elevate/ui/styles/globals.css'
```

#### Utilities
```typescript
// BEFORE & AFTER (unchanged)
import { cn } from '@elevate/ui/lib/utils'
```

## Component-Specific Changes

### ProfileCard & StageCard
These components are now framework-agnostic and accept an optional `LinkComponent` prop:

```typescript
// BEFORE - Hard dependency on Next.js
<ProfileCard user={user} />

// AFTER - Framework-agnostic
import Link from 'next/link'
<ProfileCard user={user} LinkComponent={Link} />
```

### SentryErrorBoundary → SentryBoundary
The Sentry error boundary has been renamed:

```typescript
// BEFORE
import { SentryErrorBoundary } from '@elevate/ui/components/SentryErrorBoundary'

// AFTER
import { SentryBoundary } from '@elevate/ui/feedback'
```

### CsrfProtectedForm
Now properly located in blocks:

```typescript
// BEFORE
import { CsrfProtectedForm } from '@elevate/ui/components/csrf-protected-form'

// AFTER
import { CsrfProtectedForm } from '@elevate/ui/blocks'
```

## Complete Import Map

### Root Exports (@elevate/ui)
- Alert, AlertTitle, AlertDescription
- Badge, badgeVariants
- Button, buttonVariants
- Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent
- Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription
- Form (react-hook-form components)
- Input
- Label
- Select (and all Select sub-components)
- Table (and all Table sub-components)
- Textarea
- cn (utility function)

### Block Exports (@elevate/ui/blocks)
- CsrfProtectedForm
- DataTable, createColumns
- FileUpload, FileList, UploadedFile (type)
- FormField
- LanguageSwitcher
- LeaderboardPreview
- LeaderboardTable
- LoadingSpinner, PageLoading
- MetricsChart, StatsGrid
- Modal, ConfirmModal
- ProfileCard
- ShareButton, SocialShareButtons
- StageCard
- StatusBadge
- StoriesGrid

### Section Exports (@elevate/ui/blocks/sections)
- ConveningTeaser
- DualPaths
- FAQList
- HeroSection
- ImpactRipple
- PartnersContact
- ProgramFlow

### Next.js Exports (@elevate/ui/next)
- AdminLayout
- ClientHeader
- Footer
- Header

### Feedback Exports (@elevate/ui/feedback)
- ErrorBoundary
- SentryBoundary

## Migration Script

For large codebases, use this find-and-replace script:

```bash
# Update CSS imports
find apps -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  "s|'@elevate/ui/globals.css'|'@elevate/ui/styles/globals.css'|g"

# Update FileUpload imports
find apps -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  "s|from '@elevate/ui/FileUpload'|from '@elevate/ui/blocks'|g"

# Update component imports (example for common ones)
find apps -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  "s|from '@elevate/ui/components/DataTable'|from '@elevate/ui/blocks'|g"

find apps -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  "s|from '@elevate/ui/components/Header'|from '@elevate/ui/next'|g"
```

## Build Configuration

If you're importing the UI package in a Next.js app and encountering build issues, you may need to transpile it:

```javascript
// next.config.js
module.exports = {
  transpilePackages: ['@elevate/ui'],
  // ... other config
}
```

## TypeScript Configuration

The package now properly exports types through multiple entry points. Your TypeScript configuration should automatically resolve these, but ensure you have:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true
  }
}
```

## Validation

After migrating, run these checks:

1. **Type checking**: `pnpm type-check`
2. **Build**: `pnpm build`
3. **Linting**: `pnpm lint`

## Breaking Changes

1. **Removed duplicate components** - Use only from `@elevate/ui` (primitives) or `@elevate/ui/blocks` (composites)
2. **SentryErrorBoundary renamed** to SentryBoundary
3. **CSS path changed** from `/globals.css` to `/styles/globals.css`
4. **No deep imports allowed** - Use only the documented export paths
5. **ProfileCard/StageCard** now require LinkComponent prop for Next.js links

## Benefits of the New Structure

1. **Clear separation of concerns** - Primitives, blocks, and framework-specific code are isolated
2. **Better tree-shaking** - Import only what you need
3. **Framework flexibility** - Core components work in any React app
4. **Type safety** - Proper TypeScript exports with source maps
5. **No duplicates** - Single source of truth for all components
6. **CI validation** - Automated checks prevent drift and duplicates

## Support

If you encounter issues during migration:
1. Check that all imports match the new structure
2. Clear your build cache: `pnpm clean && pnpm build`
3. Ensure you're using the latest version of @elevate/ui
4. Verify your bundler configuration supports ESM

## Future-Proofing

This new structure aligns with:
- shadcn/ui best practices
- Modern ESM standards
- React Server Components
- The monorepo's BUILDING.md specifications

The package is now maintainable, scalable, and follows industry standards for component libraries.