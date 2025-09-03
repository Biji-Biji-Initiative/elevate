# Changesets

## Overview

This workspace uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing of packages in the monorepo. All packages are currently configured as private with linked versions, meaning they are versioned together as a cohesive unit.

## Configuration

- **Fixed Versions**: All packages in this monorepo are versioned together using the `fixed` configuration
- **Private Packages**: All packages are private by default with `access: "restricted"`
- **Base Branch**: `main`
- **Changelog**: Uses the default `@changesets/cli/changelog` generator

## Usage

### Creating a Changeset

When you make changes to any package that should trigger a version bump:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of the changes

### Versioning Packages

To consume changesets and bump package versions:

```bash
pnpm version
```

This will:
- Update package versions based on changesets
- Update dependencies between packages
- Generate/update CHANGELOG.md files
- Remove consumed changeset files

### Publishing (Future)

When packages are made public, use:

```bash
pnpm release
```

This will build all packages and publish them to npm.

## Changeset Types

- **patch**: Bug fixes and small improvements
- **minor**: New features that don't break existing functionality  
- **major**: Breaking changes

## Best Practices

1. **Always create a changeset** when making changes that affect package functionality
2. **Write clear summaries** that explain what changed and why
3. **Use semantic versioning** appropriately (patch/minor/major)
4. **Group related changes** in a single changeset when possible
5. **Review changesets** before merging PRs to ensure appropriate versioning

## Example Changeset

After running `pnpm changeset`, you'll create a file like:

```md
---
"@elevate/ui": patch
"@elevate/types": patch
---

Fix button component accessibility issues and update type definitions for better TypeScript support
```

## Automation

- Changesets are validated in CI
- All packages use linked versioning for consistency
- Private packages can still use changeset workflows for internal version tracking