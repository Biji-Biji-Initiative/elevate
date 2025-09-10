---
title: Lean Documentation Plan - Radical Consolidation
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [documentation, consolidation, lean]
---

## Lean Documentation Plan

**Problem**: 174 markdown files is absurd. Most are outdated, duplicated, or irrelevant.

**Solution**: Keep only **12 essential docs** that developers actually need.

## Current Reality Check

### What Developers Actually Use Daily

From `package.json` analysis, the **real** commands are:

- `pnpm dev` - Start development
- `pnpm build` - Build everything
- `pnpm test` - Run tests
- `pnpm db:*` - Database operations
- `pnpm verify:all` - Validation
- `pnpm deploy:*` - Deployment

### Actual Codebase Structure

From code analysis:

- **2 Next.js apps**: `web` (public + dashboard), `admin` (review console)
- **Real database**: 11 Prisma models (User, Submission, PointsLedger, etc.)
- **Real APIs**: `/api/submissions`, `/api/admin/*`, `/api/kajabi/webhook`, etc.
- **Real auth**: Clerk with role-based access (PARTICIPANT, REVIEWER, ADMIN)

## The Lean 12: Essential Docs Only

### Core (4 docs)

1. **`README.md`** - Project overview, quick start
2. **`docs/DEVELOPMENT.md`** - Setup, build, test, debug (updated to match reality)
3. **`docs/DEPLOYMENT.md`** - How to deploy (consolidated from 3 guides)
4. **`docs/CONTRIBUTING.md`** - How to contribute

### Technical (4 docs)

5. **`docs/DATABASE.md`** - Schema, migrations, operations
6. **`docs/API.md`** - Real API endpoints and usage
7. **`docs/SECURITY.md`** - Auth, RBAC, privacy
8. **`BUILDING.md`** - Build system (already exists, keep)

### Process (2 docs)

9. **`docs/ARCHITECTURE.md`** - System design decisions
10. **`docs/ONBOARDING.md`** - New engineer guide

### Reference (2 docs)

11. **`docs/TROUBLESHOOTING.md`** - Common issues and fixes
12. **`docs/CHANGELOG.md`** - What's changed

## What Gets Archived/Deleted

### Archive (Move to `archive/`)

- All 31 status/migration reports
- All planning docs in `plan/`
- All legacy guides and summaries
- Package-specific docs (keep only essential READMEs)

### Delete/Consolidate

- Duplicate deployment guides ✅ (already done)
- Scattered topic docs → consolidate into the 12 core docs
- Generated docs that are outdated
- Experimental/draft docs

## Accuracy Fixes Needed

Our current docs have **major inaccuracies**:

### Database Schema Mismatch

- **Docs say**: Basic User/Submission/Points models
- **Reality**: 11 models including KajabiEvent, LearnTagGrant, SubmissionAttachment, AuditLog

### API Endpoints Mismatch

- **Docs say**: Generic REST patterns
- **Reality**: Specific endpoints like `/api/admin/kajabi`, `/api/admin/exports`, `/api/files/[...path]`

### Commands Mismatch

- **Docs say**: Basic `pnpm dev/build/test`
- **Reality**: 143 npm scripts including complex env validation, secrets management, performance monitoring

### Auth/Security Mismatch

- **Docs say**: Simple Clerk integration
- **Reality**: Complex role-based middleware, rate limiting, audit logging, security headers

## Implementation Plan

### Phase 1: Create Accurate Core Docs (2 hours)

1. **Rewrite `docs/DEVELOPMENT.md`** with actual commands from package.json
2. **Rewrite `docs/DATABASE.md`** with actual Prisma schema
3. **Rewrite `docs/API.md`** with actual endpoints from apps/
4. **Rewrite `docs/SECURITY.md`** with actual auth implementation

### Phase 2: Archive Legacy (30 minutes)

1. Move all status/migration docs to `archive/legacy/`
2. Move planning docs to `archive/planning/`
3. Clean up package docs - keep only essential READMEs

### Phase 3: Validate & Test (30 minutes)

1. Ensure all 12 docs are accurate
2. Test that examples actually work
3. Verify links and references

## Success Criteria

- **12 docs total** (down from 174)
- **100% accuracy** - every example works with current codebase
- **Zero duplication** - one source of truth per topic
- **Developer-focused** - covers 90% of daily tasks

## The Lean 12 Structure

```
/
├── README.md                    # Project overview
├── BUILDING.md                  # Build system (keep existing)
└── docs/
    ├── DEVELOPMENT.md           # Daily development guide
    ├── DEPLOYMENT.md            # How to deploy
    ├── CONTRIBUTING.md          # How to contribute
    ├── DATABASE.md              # Schema and operations
    ├── API.md                   # Endpoints and usage
    ├── SECURITY.md              # Auth, RBAC, privacy
    ├── ARCHITECTURE.md          # System design
    ├── ONBOARDING.md            # New engineer guide
    ├── TROUBLESHOOTING.md       # Common issues
    └── CHANGELOG.md             # What's changed
```

**Everything else gets archived or deleted.**

This is the only way to have maintainable, accurate documentation that developers will actually use.

---

_Radical problems require radical solutions. 12 accurate docs > 174 outdated ones._
