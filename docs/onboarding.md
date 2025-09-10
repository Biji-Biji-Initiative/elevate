---
title: Engineering Onboarding
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [onboarding, new-hire, setup]
---

## Engineering Onboarding

Fast-track guide to get new engineers productive on the MS Elevate LEAPS Tracker within their first week.

## Pre-Onboarding Setup

### Required Accounts & Access

- **GitHub**: Access to the repository
- **Vercel**: Deploy access (admin will add you)
- **Supabase**: Database access (admin will add you)
- **Clerk**: Authentication dashboard access
- **Sentry**: Error monitoring access

### Development Environment

- **Node.js**: 20.11+ ([Download](https://nodejs.org/))
- **pnpm**: 10+ (`npm install -g pnpm`)
- **Git**: Latest version
- **VS Code**: Recommended editor with extensions:
  - TypeScript and JavaScript Language Features
  - Prisma
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier

## Day 1: Environment Setup

### 1. Clone and Install (30 minutes)

```bash
# Clone repository
git clone [repo-url]
cd elevate

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
```

### 2. Environment Configuration (45 minutes)

Edit `.env.local` with development values:

```bash
# Database (ask team for dev database URL)
DATABASE_URL=postgresql://...

# Clerk (ask team for dev keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (ask team for dev instance)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE=...

# Optional for local development
KAJABI_WEBHOOK_SECRET=dev_secret
RESEND_API_KEY=dev_key
```

### 3. Initial Setup (15 minutes)

```bash
# Run setup script
pnpm setup

# Generate Prisma client
pnpm db:generate

# Seed database with test data
pnpm db:seed
```

### 4. Start Development (5 minutes)

```bash
# Start both apps
pnpm dev

# Verify apps are running:
# Web: http://localhost:3000
# Admin: http://localhost:3001
```

### 5. Verify Setup (15 minutes)

- [ ] Both apps load without errors
- [ ] Can sign in with Google OAuth (Clerk)
- [ ] Dashboard shows test data from seed
- [ ] Admin console accessible with admin role
- [ ] Database queries work in Prisma Studio (`pnpm db:studio`)

**Total Day 1 Time: ~2 hours**

## Day 2-3: Codebase Exploration

### Understanding the Architecture

1. **Read Core Docs** (1 hour):

   - [`docs/development.md`](./development.md) - Development guide
   - [`docs/architecture/overview.md`](./architecture/overview.md) - System architecture
   - [`BUILDING.md`](../BUILDING.md) - Build system

2. **Explore the Monorepo** (1 hour):

   ```bash
   # Understand package structure
   ls packages/

   # Key packages to explore:
   # - packages/db/ (database schema)
   # - packages/ui/ (shared components)
   # - packages/auth/ (authentication)
   # - packages/types/ (TypeScript definitions)
   ```

3. **Run the Test Suite** (30 minutes):

   ```bash
   # Run all tests
   pnpm test

   # Run specific test types
   pnpm test:unit
   pnpm test:integration
   ```

### First Code Changes

4. **Make a Small Change** (1 hour):

   - Find a simple UI component in `packages/ui/src/`
   - Make a minor styling change
   - Test in both web and admin apps
   - Create a PR with the change

5. **Database Exploration** (45 minutes):

   ```bash
   # Open Prisma Studio
   pnpm db:studio

   # Explore the schema
   cat packages/db/schema.prisma

   # Try a simple migration
   # (Add a comment to a model, then run)
   pnpm db:migrate
   ```

## Day 4-5: Feature Development

### Understanding LEAPS Workflow

6. **Study the LEAPS System** (1 hour):

   - Read [`docs/leaps/README.md`](./leaps/README.md)
   - Understand the 5 stages: Learn, Explore, Amplify, Present, Shine
   - Review scoring system in [`docs/scoring.md`](./scoring.md)

7. **Trace a User Journey** (1 hour):
   - Sign in as a test user
   - Submit evidence for each LEAPS stage
   - Switch to admin role and approve submissions
   - Watch points get awarded and leaderboard update

### Build a Small Feature

8. **Pick a Starter Task** (2-3 hours):

   Good first tasks:

   - Add a new field to a form
   - Create a simple dashboard widget
   - Add validation to an existing endpoint
   - Write tests for an existing component

   **Suggested: Add "Last Login" to User Profile**

   ```typescript
   // 1. Add field to Prisma schema
   // packages/db/schema.prisma
   model User {
     // ... existing fields
     lastLoginAt DateTime?
   }

   // 2. Create migration
   // pnpm db:migrate

   // 3. Update auth middleware to track login
   // packages/auth/src/middleware.ts

   // 4. Display in user profile component
   // packages/ui/src/blocks/UserProfile.tsx

   // 5. Add tests
   // packages/auth/src/__tests__/login-tracking.test.ts
   ```

## Week 1: Team Integration

### Code Review & Standards

9. **Learn Code Standards** (1 hour):

   - Review [`VALIDATION_SYSTEMS.md`](../VALIDATION_SYSTEMS.md)
   - Run validation locally: `pnpm verify:all`
   - Understand import/export rules
   - Learn TypeScript patterns used in the codebase

10. **Participate in Code Review** (ongoing):
    - Review a teammate's PR
    - Get your PR reviewed
    - Learn team conventions and preferences

### Domain Knowledge

11. **Understand the Business** (1 hour):

    - Read program documentation in [`plan/`](../plan/)
    - Understand Indonesian education context
    - Learn about Microsoft's role and objectives

12. **Security & Privacy** (30 minutes):
    - Review [`docs/roles-permissions.md`](./roles-permissions.md)
    - Understand PII handling policies
    - Learn about data visibility rules

## Common Gotchas for New Engineers

### Build System

- **Import Paths**: Never import from `src/` or `dist/` directly

  ```typescript
  // ❌ Wrong
  import { Button } from '@elevate/ui/src/components/Button'

  // ✅ Correct
  import { Button } from '@elevate/ui'
  ```

- **Package Exports**: Check `package.json` exports field for available imports
- **Two-Stage Build**: Types build first, then JavaScript bundles

### Database

- **Schema Changes**: Always create migrations, never edit the database directly
- **Seed Data**: Use `pnpm db:seed` for consistent test data
- **Connection**: Database URL must be synced to Prisma before operations

### Authentication

- **Role Checking**: Use `@elevate/auth` helpers, not direct Clerk calls
- **Server vs Client**: Different auth patterns for API routes vs components
- **Development**: Test users are created by the seed script

### Environment Variables

- **Cascading**: Root `.env.local` cascades to apps automatically
- **Validation**: `pnpm dev` validates required variables
- **Sync**: Database env must be synced to Prisma config

## Getting Help

### Documentation

- **Start Here**: [`docs/development.md`](./development.md)
- **Architecture**: [`docs/architecture/overview.md`](./architecture/overview.md)
- **API Usage**: [`docs/api/index.md`](./api/index.md)
- **Troubleshooting**: Check validation with `pnpm verify:all`

### Team Communication

- **Questions**: Ask in team chat or create GitHub discussions
- **Bugs**: Create GitHub issues with reproduction steps
- **Ideas**: Propose Architecture Decision Records (ADRs)

### Debugging

```bash
# Check everything is working
pnpm verify:all

# Debug specific issues
pnpm db:studio              # Database browser
pnpm build:verify           # Build artifacts
pnpm analyze:bundles        # Bundle analysis
DEBUG=* pnpm dev            # Enable debug logging
```

## Success Metrics

### End of Day 1

- [ ] Local environment running
- [ ] Can sign in and see test data
- [ ] Basic understanding of monorepo structure

### End of Week 1

- [ ] Made first code contribution
- [ ] Understands LEAPS workflow
- [ ] Can run tests and validation
- [ ] Comfortable with team processes
- [ ] Knows where to find documentation

### End of Month 1

- [ ] Delivered first feature
- [ ] Participated in code reviews
- [ ] Understands system architecture
- [ ] Can debug common issues independently

## Next Steps

After your first week, you'll be ready to:

- Take on larger feature development
- Participate in architecture discussions
- Mentor future new hires
- Contribute to documentation improvements

Welcome to the team! 🚀

---

_This guide is updated regularly based on new hire feedback. Please suggest improvements after your onboarding experience._
