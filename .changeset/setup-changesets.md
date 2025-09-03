---
"@elevate/ui": patch
"@elevate/types": patch
"@elevate/config": patch
"@elevate/security": patch
"@elevate/auth": patch
"@elevate/emails": patch
"@elevate/logic": patch
"@elevate/openapi": patch
"@elevate/storage": patch
"@elevate/integrations": patch
"@elevate/db": patch
---

Setup Changesets for versioning and release management

- Install @changesets/cli as dev dependency
- Configure fixed versioning for all packages
- Update publishConfig to use restricted access with provenance
- Add repository information to all packages
- Add changeset scripts to root package.json
- Setup CI validation for changesets