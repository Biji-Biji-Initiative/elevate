# UI Package Migration Plan - shadcn/ui Alignment

## Executive Summary
This plan details the complete migration of the @elevate/ui package to a canonical shadcn/ui structure, eliminating duplicates, organizing components by type, and aligning with BUILDING.md specifications.

## Current Issues
1. **7 duplicate shadcn components** exist in both `/components/` and `/components/ui/`
2. **6 Next.js-dependent components** mixed with framework-agnostic ones
3. **Inconsistent exports** - only FileUpload has individual export
4. **No ESM .js extensions** in imports
5. **Mixed component organization** - some in root, some nested

## Target Architecture

```
packages/ui/
├── package.json                        # ESM module with proper exports
├── tsup.config.ts                     # Two-stage build per BUILDING.md
├── tsconfig.json                      # Editor config (noEmit)
├── tsconfig.build.json                # Build config (declarations only)
├── tailwind.config.ts                 # Shared Tailwind configuration
└── src/
   ├── lib/
   │   └── utils.ts                    # cn() utility (single source)
   ├── styles/
   │   └── globals.css                 # CSS variables and tokens
   ├── components/
   │   └── ui/                         # ONLY shadcn primitives
   │       ├── alert.tsx
   │       ├── badge.tsx
   │       ├── button.tsx
   │       ├── card.tsx
   │       ├── dialog.tsx
   │       ├── form.tsx
   │       ├── input.tsx
   │       ├── label.tsx
   │       ├── select.tsx
   │       ├── table.tsx
   │       └── textarea.tsx
   ├── blocks/                         # Composite components
   │   ├── DataTable.tsx
   │   ├── FileUpload.tsx
   │   ├── FormField.tsx
   │   ├── LanguageSwitcher.tsx
   │   ├── LeaderboardPreview.tsx
   │   ├── LeaderboardTable.tsx
   │   ├── LoadingSpinner.tsx
   │   ├── MetricsChart.tsx
   │   ├── Modal.tsx
   │   ├── ProfileCard.tsx
   │   ├── ShareButton.tsx
   │   ├── StageCard.tsx
   │   ├── StatusBadge.tsx
   │   ├── StoriesGrid.tsx
   │   └── sections/                   # Page sections
   │       ├── ConveningTeaser.tsx
   │       ├── DualPaths.tsx
   │       ├── FAQList.tsx
   │       ├── HeroSection.tsx
   │       ├── ImpactRipple.tsx
   │       ├── PartnersContact.tsx
   │       └── ProgramFlow.tsx
   ├── next/                           # Next.js-specific
   │   ├── AdminLayout.tsx
   │   ├── ClientHeader.tsx
   │   ├── Header.tsx
   │   └── Footer.tsx
   ├── feedback/                       # Error boundaries
   │   ├── ErrorBoundary.tsx
   │   └── SentryBoundary.tsx
   └── index.ts                        # Curated exports

```

## Migration Steps

### Phase 1: Setup & Configuration
1. **Create new directory structure**
   - Create blocks/, blocks/sections/, next/, feedback/, styles/ directories
   - Keep components/ui/ as-is (already correct)

2. **Move globals.css to styles/**
   - Move src/globals.css → src/styles/globals.css
   - Update all references

### Phase 2: Component Migration

#### Delete Duplicates
Remove these duplicate files from src/components/:
- badge.tsx (keep ui/badge.tsx)
- button.tsx (keep ui/button.tsx)  
- card.tsx (keep ui/card.tsx)
- form.tsx (keep ui/form.tsx)
- input.tsx (keep ui/input.tsx)
- label.tsx (keep ui/label.tsx)
- table.tsx (keep ui/table.tsx)

#### Move to blocks/
- DataTable.tsx
- LanguageSwitcher.tsx
- LeaderboardPreview.tsx
- LeaderboardTable.tsx
- LoadingSpinner.tsx
- MetricsChart.tsx
- Modal.tsx
- ShareButton.tsx
- StatusBadge.tsx
- StoriesGrid.tsx

#### Move to blocks/sections/
- ConveningTeaser.tsx
- DualPaths.tsx
- FAQList.tsx
- HeroSection.tsx
- ImpactRipple.tsx
- PartnersContact.tsx
- ProgramFlow.tsx

#### Move to next/ (Next.js-dependent)
- AdminLayout.tsx (uses next/link)
- ClientHeader.tsx (uses next/navigation)
- Header.tsx (uses next/link)
- Footer.tsx (uses next/link)

#### Special Components

**ProfileCard.tsx & StageCard.tsx**
- Currently use next/link
- Create framework-agnostic versions in blocks/
- Add optional linkComponent prop for customization

**FileUpload.tsx & FormField.tsx**
- Move from root to blocks/

**csrf-protected-form.tsx**
- Move to blocks/ as CsrfProtectedForm.tsx

#### Move to feedback/
- ErrorBoundary.tsx (make framework-agnostic)
- SentryErrorBoundary.tsx → SentryBoundary.tsx

### Phase 3: Import Path Updates

All imports must use ESM .js extensions per BUILDING.md:
```typescript
// Before
import { cn } from '../lib/utils'

// After  
import { cn } from '../lib/utils.js'
```

### Phase 4: Build Configuration

#### tsup.config.ts (Two-stage build)
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'blocks/index': 'src/blocks/index.ts',
    'blocks/sections/index': 'src/blocks/sections/index.ts',
    'next/index': 'src/next/index.ts',
    'feedback/index': 'src/feedback/index.ts'
  },
  format: ['esm'],
  dts: false, // Types from tsc
  sourcemap: true,
  clean: true,
  outDir: 'dist/js',
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/link',
    'next/navigation',
    '@sentry/nextjs',
    /^@radix-ui\//,
    'lucide-react',
    'class-variance-authority',
    'tailwind-merge',
    'clsx'
  ]
})
```

#### package.json exports
```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/js/index.js"
    },
    "./styles/globals.css": "./dist/styles/globals.css",
    "./blocks": {
      "types": "./dist/types/blocks/index.d.ts",
      "import": "./dist/js/blocks/index.js"
    },
    "./blocks/sections": {
      "types": "./dist/types/blocks/sections/index.d.ts",
      "import": "./dist/js/blocks/sections/index.js"
    },
    "./next/*": {
      "types": "./dist/types/next/*.d.ts",
      "import": "./dist/js/next/*.js"
    },
    "./feedback/*": {
      "types": "./dist/types/feedback/*.d.ts",
      "import": "./dist/js/feedback/*.js"
    },
    "./package.json": "./package.json"
  }
}
```

### Phase 5: Index Files

#### src/index.ts (main export)
```typescript
// shadcn primitives
export * from './components/ui/alert.js'
export * from './components/ui/badge.js'
export * from './components/ui/button.js'
export * from './components/ui/card.js'
export * from './components/ui/dialog.js'
export * from './components/ui/form.js'
export * from './components/ui/input.js'
export * from './components/ui/label.js'
export * from './components/ui/select.js'
export * from './components/ui/table.js'
export * from './components/ui/textarea.js'

// utils
export { cn } from './lib/utils.js'

// Selected blocks
export { DataTable } from './blocks/DataTable.js'
export { FileUpload, FileList } from './blocks/FileUpload.js'
export { LoadingSpinner } from './blocks/LoadingSpinner.js'
// ... etc
```

### Phase 6: Validation & CI

#### ESLint Rules (.eslintrc.js)
```javascript
{
  "rules": {
    "import/extensions": ["error", "ignorePackages"],
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          "../components/*",
          "../*/*/ui/*",
          "@elevate/ui/src/*"
        ]
      }
    ]
  }
}
```

#### Duplicate Detection Script (scripts/check-ui-duplicates.js)
```javascript
const fs = require('fs')
const path = require('path')

// Check for duplicate component basenames
const uiDir = 'packages/ui/src/components/ui'
const componentsDir = 'packages/ui/src/components'

const uiFiles = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'))
const componentFiles = fs.readdirSync(componentsDir)
  .filter(f => f.endsWith('.tsx') && !fs.statSync(path.join(componentsDir, f)).isDirectory())

const duplicates = componentFiles.filter(f => uiFiles.includes(f))

if (duplicates.length > 0) {
  console.error('Duplicate components found:', duplicates)
  process.exit(1)
}
```

## Success Criteria

- [ ] Zero duplicate shadcn components
- [ ] Clean directory structure (ui/, blocks/, next/, feedback/)
- [ ] All imports use .js extensions
- [ ] Two-stage build working (types + JS)
- [ ] Proper package.json exports
- [ ] Framework-agnostic by default
- [ ] Next.js components isolated
- [ ] CI duplicate detection passing
- [ ] API Extractor reports stable
- [ ] Consumer fixtures building

## Timeline

- **Hour 1-2**: Setup directories, move files
- **Hour 3-4**: Update imports, add .js extensions
- **Hour 5-6**: Configure build, exports
- **Hour 7-8**: Testing, validation, CI setup

## Risk Mitigation

1. **Breaking Changes**: Will affect all consumers
   - Mitigation: Provide migration guide, codemod script
   
2. **Import Path Changes**: Apps need updates
   - Mitigation: Clear documentation, find-replace commands
   
3. **Build Complexity**: Two-stage build may have issues
   - Mitigation: Test thoroughly, have rollback plan

## Post-Migration

1. Update all apps to use new imports
2. Run full test suite
3. Verify production builds
4. Update documentation
5. Create migration guide for external consumers