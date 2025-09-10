# MS Elevate Indonesia LEAPS Tracker

Platform for Indonesian educators to progress through the LEAPS framework (Learn, Explore, Amplify, Present, Shine) while adopting AI in classrooms.

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd elevate
pnpm install

# Setup environment (copy .env.example to .env.local and fill in values)
cp .env.example .env.local

# Setup database and start development
pnpm setup
pnpm dev
```

Visit:

- Web app: http://localhost:3000
- Admin app: http://localhost:3001

## Architecture

- **2 Next.js Apps**: Web (public + dashboard) and Admin (review console)
- **Database**: PostgreSQL via Supabase with Prisma ORM
- **Auth**: Clerk with Google OAuth and role-based access
- **Storage**: Supabase Storage for evidence files
- **Deployment**: Vercel (separate projects for web/admin)

## Documentation

- **[Development Guide](docs/DEVELOPMENT.md)** - Setup, build, test, debug
- **[API Reference](docs/API.md)** - All endpoints and usage
- **[Database Schema](docs/DATABASE.md)** - Prisma models and queries
- **[Deployment Guide](docs/DEPLOYMENT.md)** - How to deploy
- **[Admin Guide](docs/admin/ADMIN_GUIDE.md)** - Kajabi health/invite, retention, Ops
- **[Ops Runbook](docs/OPS_RUNBOOK.md)** - Environment, endpoints, cron
- **[Staging Validation](docs/qa/STAGING_VALIDATION.md)** - E2E validation checklist
- **[Security Guide](docs/SECURITY.md)** - Auth, RBAC, privacy
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute
- **[Onboarding Guide](docs/ONBOARDING.md)** - New engineer setup

## Key Commands

```bash
# Development
pnpm dev                # Start both apps
pnpm build              # Build everything
pnpm test               # Run tests
pnpm verify:all         # Run all validation
pnpm qa:validate:staging # Probe staging endpoints (see docs/qa/STAGING_VALIDATION.md)

# Database
pnpm db:studio          # Open Prisma Studio
pnpm db:seed            # Seed test data
pnpm db:migrate         # Run migrations

# Deployment
pnpm deploy:web:prod    # Deploy web app
pnpm deploy:admin:prod  # Deploy admin app
```

## Project Structure

```
elevate/
├── apps/
│   ├── web/           # Public site + participant dashboard
│   └── admin/         # Admin console for reviewers
├── packages/
│   ├── auth/          # Clerk authentication helpers
│   ├── db/            # Prisma schema + database utilities
│   ├── ui/            # Shared UI components (shadcn/ui)
│   ├── types/         # Shared TypeScript types
│   └── ...
├── docs/              # Documentation
└── scripts/           # Build, deploy, and utility scripts
```

## LEAPS Framework

1. **Learn** (20 points) - Complete AI course and upload certificate
2. **Explore** (50 points) - Apply AI in classroom with evidence
3. **Amplify** (variable points) - Train peers/students (2 pts/peer, 1 pt/student)
4. **Present** (20 points) - Share story on LinkedIn
5. **Shine** - Recognition and badges

## License

MIT License - see LICENSE file for details.
