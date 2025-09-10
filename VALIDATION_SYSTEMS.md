---
title: Validation Systems - Phase 4 Implementation
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [validation, quality, ci, build]
---

## Validation Systems - Phase 4 Implementation

This document describes the comprehensive validation infrastructure implemented in Phase 4 to prevent code quality drift and maintain alignment with [BUILDING.md](./BUILDING.md) principles.

## Overview

The validation system consists of multiple layers of checks that ensure:

- TypeScript compilation without errors
- Import path boundaries and restrictions
- Export/entry point alignment
- Code quality standards
- API surface stability
- Build system integrity

## Validation Scripts

### Core Scripts

#### 1. `validate-imports.mjs`

**Purpose**: Block deep internal imports per BUILDING.md Section 12

**What it checks**:

- Prevents imports from `@elevate/*/src/*` paths
- Blocks imports from `@elevate/*/dist/*` paths
- Detects cross-package src/ imports
- Flags relative package imports that should be workspace imports

**Usage**:

```bash
pnpm run verify:imports
# or directly: node scripts/validate-imports.mjs
```

**Example violations caught**:

```typescript
// ❌ Forbidden
import { utils } from '@elevate/ui/src/internal/utils'
import Client from '@elevate/openapi/dist/sdk'

// ✅ Correct
import { utils } from '@elevate/ui'
import Client from '@elevate/openapi/sdk'
```

#### 2. `validate-exports.mjs`

**Purpose**: Ensure tsup entries match package.json exports per BUILDING.md Section 11

**What it checks**:

- Compares tsup config entry points with package.json exports
- Detects missing exports for bundled entries
- Finds exports without corresponding tsup entries
- Handles both array and object entry formats

**Usage**:

```bash
pnpm run verify:exports
# or directly: node scripts/validate-exports.mjs
```

#### 3. `lint-fix-verify.mjs`

**Purpose**: Post-lint-fix validation per BUILDING.md Section 11

**What it checks**:

- TypeScript compilation after lint fixes
- ESLint passes without errors
- Import paths remain valid
- Export alignment preserved
- Package builds still work
- Common post-fix regressions

**Usage**:

```bash
pnpm run lint:fix:verify
# or directly: node scripts/lint-fix-verify.mjs
```

### Comprehensive Scripts

#### 4. `validate-all.mjs`

**Purpose**: Run all validation checks with comprehensive reporting

**Checks performed**:

1. TypeScript Compilation (`typecheck:build`)
2. Import Path Validation (`validate-imports.mjs`)
3. Export/Entry Alignment (`validate-exports.mjs`)
4. ESLint Package Check (`lint:packages`)
5. Code Quality Checks (`validate-code-quality.mjs`)
6. API Report Generation (`api:extract`)
7. Build Types Check (`build:types`)

**Usage**:

```bash
pnpm run verify:all
# or directly: node scripts/validate-all.mjs
```

**Output Format**:

- ✅ Critical checks (must pass for deployment)
- ⚠️ Optional checks (warnings, should be addressed)
- Detailed error reporting with actionable guidance
- Performance metrics (duration per check)

#### 5. `validate-code-quality.mjs` (Enhanced)

**Purpose**: Comprehensive code quality validation

**Checks performed**:

- Duplicate test file detection
- ESM import extensions compliance
- Test file location validation
- Deprecated import detection
- Package boundary enforcement
- TypeScript configuration consistency
- Generated artifact location verification

## Integration with CI/CD

### Package.json Scripts

The following scripts are available:

```json
{
  "verify:imports": "node scripts/validate-imports.mjs",
  "verify:exports": "node scripts/validate-exports.mjs",
  "verify:all": "node scripts/validate-all.mjs",
  "lint:fix:verify": "node scripts/lint-fix-verify.mjs",
  "ci": "... && pnpm run verify:all && ..."
}
```

### CI Pipeline Integration

The `ci` script now uses `verify:all` as a single comprehensive check:

```bash
pnpm run ci
```

This runs:

1. Environment validation
2. Build checks
3. Security verification
4. **Comprehensive validation (`verify:all`)**
5. Consumer fixture testing
6. Database tests
7. Test coverage

### GitHub Actions Integration

The validation scripts integrate with existing GitHub workflows:

```yaml
# .github/workflows/ci.yml
- name: Run comprehensive validation
  run: pnpm run verify:all

- name: Post-lint verification (if lint fixes are applied)
  run: pnpm run lint:fix:verify
```

## ESLint Configuration Hardening

The existing ESLint configuration already includes strong rules per BUILDING.md:

### Import Restrictions

```javascript
// Prevents deep internal imports
'no-restricted-imports': [
  'error',
  {
    patterns: ['@elevate/*/src/*', '@elevate/*/dist/*'],
  },
],
```

### Extension Handling

```javascript
// ESM import hygiene per BUILDING.md Section 6
'import/extensions': [
  'error',
  'ignorePackages',
  {
    js: 'always',
    jsx: 'never',
    ts: 'never',
    tsx: 'never',
  },
],
```

### Type Safety

```javascript
// Strict type safety rules - zero tolerance
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-member-access': 'error',
'@typescript-eslint/no-unsafe-return': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-argument': 'error',
```

## API Extractor Integration

API Extractor is configured and integrated per BUILDING.md Section 9:

### Configuration

- Base configuration: `api-extractor.base.json`
- Per-package configurations: `packages/*/api-extractor.json`
- API reports committed to git: `packages/*/api-reports/*.api.md`

### Scripts

```bash
pnpm run api:extract  # Update API reports
pnpm run api:check    # Validate API reports match code
```

### Workflow

1. Build types: `pnpm run build:types`
2. Extract API: `pnpm run api:extract`
3. Review changes in `.api.md` files
4. Commit API report updates with code changes

## Error Handling and Reporting

### Validation Script Output

All validation scripts provide:

- Colored output for easy scanning
- Actionable error messages
- Performance metrics
- Summary statistics
- Specific guidance for common fixes

### Error Categories

**Critical Errors** (CI fails):

- TypeScript compilation failures
- Import boundary violations
- Export/entry mismatches
- ESLint violations
- Build failures

**Warnings** (CI passes with warnings):

- Code quality issues
- API report updates needed
- Performance regressions

## Drift Prevention Strategies

### 1. Automated Validation

- All PRs must pass `verify:all`
- Post-lint-fix verification prevents regressions
- API reports catch unintended breaking changes

### 2. Configuration Alignment

- Single source of truth for entries vs exports
- TypeScript project references properly configured
- ESLint rules enforce boundaries

### 3. Documentation

- Clear guidance in error messages
- Examples of correct vs incorrect patterns
- Integration with existing workflows

## Performance Optimization

### Validation Script Performance

- Scripts run in parallel where possible
- Intelligent filtering of files to check
- Caching of results where appropriate
- Early exit on critical failures

### CI Pipeline Efficiency

- Consolidated validation reduces redundant checks
- Better error reporting reduces debugging time
- Parallel execution of independent checks

## Troubleshooting Common Issues

### Import Violations

```bash
# Check specific import issues
pnpm run verify:imports

# Common fixes:
# Replace: import X from '@elevate/ui/src/components/X'
# With:    import X from '@elevate/ui/components'
```

### Export Misalignment

```bash
# Check export/entry alignment
pnpm run verify:exports

# Fix by updating either:
# - tsup.config.ts entries
# - package.json exports
```

### Post-Lint Issues

```bash
# After running lint --fix, verify no regressions
pnpm run lint:fix:verify

# This catches issues like:
# - Accidentally removed exports
# - Import reorganization breaking references
# - Type errors from import changes
```

## Future Enhancements

### Planned Improvements

1. **Bundle Size Validation**: Prevent size regressions
2. **Performance Benchmarking**: Track build/test times
3. **Dependency Analysis**: Detect circular dependencies
4. **Security Scanning**: Automated vulnerability checks

### Extension Points

- Plugin system for custom validation rules
- Project-specific configuration overrides
- Integration with additional linters/analyzers

## Migration Guide

For existing projects adopting this validation system:

### Step 1: Install Dependencies

```bash
# Dependencies already included in package.json
pnpm install
```

### Step 2: Run Initial Validation

```bash
pnpm run verify:all
```

### Step 3: Fix Issues

Use the specific scripts to address individual issue categories:

```bash
pnpm run verify:imports    # Fix import violations
pnpm run verify:exports    # Fix export alignment
pnpm run lint:packages     # Fix ESLint issues
pnpm run typecheck:build   # Fix TypeScript errors
```

### Step 4: Update CI

Update your CI configuration to use `pnpm run verify:all`

### Step 5: Establish Baselines

```bash
pnpm run api:extract  # Generate initial API reports
```

## Best Practices

### For Developers

1. Run `verify:all` before creating PRs
2. Use `lint:fix:verify` after ESLint fixes
3. Check `verify:imports` when refactoring imports
4. Review API report changes in PRs

### For Teams

1. Require `verify:all` to pass in CI
2. Review validation failures in PR reviews
3. Keep API reports up to date
4. Address warnings promptly to prevent accumulation

### For Maintainers

1. Monitor validation performance metrics
2. Update validation rules as the codebase evolves
3. Extend validation coverage to new quality areas
4. Document validation additions/changes

---

_This validation system implements the requirements from [BUILDING.md](./BUILDING.md) Sections 11 and 12, providing comprehensive drift prevention and quality assurance for the monorepo._
## Typed Tables and DTO Pattern

To keep UI lint/type-safety clean without weakening rules:

- Use the shared `DataTable` with generics: `DataTable<Row, Columns, Id>`.
- Define `Column<Row, Value>` with `accessor: (row) => Value` and `render: (row, value) => ...` so cell renderers receive typed values.
- Project server DTOs to flat, UI-safe rows in each page (e.g., `BadgeRow`, `UserRow`, `SubmissionRow`). Avoid deep optional chains in renderers.
- Before calling `setError`, build a local `string` with a helper (e.g., `toErrorMessage(context, err)`) to avoid “unsafe-argument/unsafe-call” warnings.

Example:

```ts
type BadgeRow = { code: string; name: string; earned_badges: number }
const columns = createColumns<BadgeRow>()([
  {
    key: 'name',
    header: 'Badge',
    accessor: (row) => row.name,
    render: (_row, value) => <strong>{value}</strong>,
  },
])

<DataTable<BadgeRow, typeof columns, string>
  data={rows}
  columns={columns}
  selection={{ selectedRows, onSelectionChange, getRowId: (r) => r.code }}
/>
```

This pattern eliminates the need for `unknown` casts and prevents analyzer warnings in pages.

## Route Analyzer Notes

Some third-party route analyzers may flag `layout.tsx` and `page.tsx` pairs as duplicates. In Next.js App Router, a route directory commonly includes both; this is not a conflict.

If your CI checker supports configuration, add ignore rules for `**/layout.tsx` when checking duplicate routes, and for `**/sitemap.*` ensure only one file per app root.
