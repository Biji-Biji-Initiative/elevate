# ESLint Configuration

This project uses ESLint 9.x with the modern flat config format (`eslint.config.mjs`).

## Features

### Core Setup
- **ESLint 9.x** with flat config format
- **TypeScript ESLint** with strict rules and type-checking
- **Next.js plugin** with React Server Components rules
- **React** and **React Hooks** plugin
- **Import sorting** with auto-organization
- **Turbo plugin** for monorepo rules
- **Accessibility** rules (jsx-a11y)
- **Prettier integration**

### Key Rules Configured

#### TypeScript
- Consistent type imports (`import type`)
- No unused variables with underscore exception
- Strict but practical type checking
- Proper async/await handling

#### React & Next.js
- Server Component boundary enforcement
- Client component validation
- React Hooks rules of hooks
- JSX accessibility rules
- Next.js best practices

#### Import Organization
```typescript
// Order: react → next → external → internal → relative
import React from 'react'
import { NextRequest } from 'next/server'
import { clsx } from 'clsx'
import { someUtil } from '@/utils'
import { localHelper } from './helper'
```

#### Code Quality
- No console.log in production
- Prefer const over let
- Proper error handling
- Smart equality checks

## Usage

### Run Linting
```bash
# Lint entire project
pnpm lint

# Lint with auto-fix
pnpm lint:fix

# Lint specific apps
pnpm lint:apps

# Lint packages only  
pnpm lint:packages

# Check format (no fixes)
pnpm lint:check
```

### Individual Apps
```bash
# In apps/web or apps/admin
pnpm lint
pnpm lint:fix
```

## VS Code Integration

The `.vscode/settings.json` is configured for:
- Auto-fix on save
- Flat config support
- TypeScript import suggestions
- Prettier formatting

Recommended extensions:
- ESLint
- Prettier
- TypeScript Importer

## Configuration Files

- `eslint.config.mjs` - Main ESLint configuration
- `tsconfig.json` - Root TypeScript config for type-checking
- `.vscode/settings.json` - VS Code ESLint settings
- `apps/*/next.config.mjs` - Next.js ESLint integration

## Ignored Files

The following are ignored by ESLint:
- `node_modules/`
- `.next/`, `dist/`, `build/`
- Generated files (`*.d.ts`, `generated/`)
- Logs, temp files, OS files
- Database migrations
- Public assets

## Monorepo Structure

Each workspace can have individual lint scripts:
- Root: Lints entire monorepo
- Apps: Next.js specific rules
- Packages: Library-specific rules

## Type-Checked Rules

Uses TypeScript projectService for:
- Async/await validation
- Type-aware rules
- Import resolution
- Cross-package type checking

## Troubleshooting

### Common Issues

1. **"Could not find plugin"** - Ensure all dependencies are installed at root
2. **Type checking errors** - Check `tsconfig.json` includes all files
3. **Import resolution** - Verify TypeScript path mapping
4. **Performance** - Use `--max-warnings 0` for CI builds

### Debug Commands

```bash
# Test config parsing
npx eslint --print-config eslint.config.mjs

# Check which files will be linted
npx eslint --debug apps/

# Lint specific file with details
npx eslint apps/web/middleware.ts --format=detailed
```

## Migration from Legacy Config

The old `.eslintrc.json` files have been removed in favor of the flat config:

- ✅ Modern plugin system
- ✅ Better TypeScript integration  
- ✅ Simplified configuration
- ✅ Improved performance
- ✅ Future-proof setup

## Adding New Rules

To add custom rules, edit `eslint.config.mjs`:

```javascript
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    'your-new-rule': 'error',
  },
}
```

For package-specific rules, add file pattern matching:

```javascript
{
  files: ['packages/ui/**/*.{ts,tsx}'],
  rules: {
    'react/prop-types': 'off', // UI package uses TypeScript
  },
}
```