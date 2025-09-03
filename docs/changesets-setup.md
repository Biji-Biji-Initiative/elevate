# Changesets Configuration

## Overview

This project is configured with Changesets for versioning and release management. All packages in the monorepo use **fixed versioning**, meaning they are versioned together as a cohesive unit.

## Configuration Details

### Fixed Versioning
All packages are configured in the `fixed` array in `config.json`, which means:
- All packages will receive the same version bump when releasing
- Dependencies between packages will be updated automatically
- Consistent versioning across the entire monorepo

### Private Package Settings
- `access: "restricted"` - All packages are private by default
- `privatePackages.version: true` - Private packages still get version bumps
- `privatePackages.tag: true` - Private packages get git tags

### Publishing Configuration
Each package includes:
```json
{
  "publishConfig": {
    "access": "restricted",
    "provenance": true,
    "registry": "https://registry.npmjs.org/"
  },
  "repository": {
    "type": "git", 
    "url": "git+https://github.com/your-org/elevate.git",
    "directory": "packages/[package-name]"
  }
}
```

## Workflow

### Development
1. Make changes to packages
2. Run `pnpm changeset` to create changeset files
3. Commit changeset files with your changes

### Release (Future)
1. Run `pnpm version` to consume changesets and update versions
2. Run `pnpm release` to build and publish packages (when made public)

## Testing

Verify configuration with:
```bash
# Check changeset status
pnpm changeset status

# Validate package configurations
pnpm verify:exports
```

## Package List

The following packages are included in fixed versioning:
- @elevate/ui
- @elevate/types  
- @elevate/config
- @elevate/security
- @elevate/auth
- @elevate/emails
- @elevate/logic
- @elevate/openapi
- @elevate/storage
- @elevate/integrations
- @elevate/db

## Scripts Available

- `pnpm changeset` - Create a new changeset
- `pnpm version` - Apply changesets and update versions
- `pnpm release` - Build and publish packages
- `pnpm prerelease` - Enter prerelease mode
- `pnpm prerelease:exit` - Exit prerelease mode