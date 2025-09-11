# MS Elevate Indonesia LEAPS Tracker

## Overview

The MS Elevate Indonesia LEAPS Tracker is a comprehensive platform designed for Indonesian educators to progress through the LEAPS framework (Learn, Explore, Amplify, Present, Shine) while adopting AI technologies in their classrooms. The platform serves as both a public site explaining the LEAPS journey and a participant dashboard where educators can submit evidence, track their progress, and compete on leaderboards.

The system includes a public-facing web application for participants and a separate admin console for reviewers to approve submissions and manage the program. Key features include point tracking across LEAPS stages, badge systems, leaderboards, and integration with external services like Kajabi for learning management and Clerk for authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a TypeScript monorepo with two main Next.js applications:
- **Web App** (`apps/web`): Public site and participant dashboard
- **Admin App** (`apps/admin`): Reviewer and administrator console
- **Shared Packages** (`packages/*`): Reusable libraries for UI, authentication, database access, and business logic

### Frontend Architecture
Both applications are built with Next.js 15 and React 19, using:
- **shadcn/ui** for consistent UI components across apps
- **TypeScript** with strict type checking and solution-style configuration
- **Tailwind CSS** for styling with shared design tokens
- **React Hook Form + Zod** for form validation
- **next-intl** for internationalization (English and Indonesian)

### Backend Architecture
The backend follows a server-first approach with:
- **Server Actions** for form handling and mutations
- **Prisma ORM** as the single source of truth for database schema
- **PostgreSQL** via Supabase for data persistence
- **Supabase Storage** for file uploads with virus scanning
- **Row Level Security (RLS)** policies for data protection

### Data Model Design
The core data model centers around:
- **Users** with role-based access (Participant, Reviewer, Admin, Superadmin)
- **Submissions** for each LEAPS stage with stage-specific payload validation
- **Points Ledger** for auditable point tracking and leaderboard calculations
- **Badges** system for achievements and recognition
- **Materialized Views** for optimized leaderboard and metrics performance

### Authentication and Authorization
- **Clerk** provides OAuth authentication with Google-only signin for MVP
- **Role-based access control (RBAC)** enforced at service boundaries
- **Server-only authentication** for admin operations
- **Public/private data separation** with proper access controls

### Performance Optimizations
- **Materialized Views** for leaderboard queries (90%+ performance improvement)
- **Turbo monorepo** for build caching and task orchestration
- **Bundle analysis** and code splitting for optimal loading
- **SLO monitoring** for performance tracking

## External Dependencies

### Core Services
- **Supabase**: PostgreSQL database, file storage, and Row Level Security
- **Clerk**: Authentication provider with Google OAuth integration
- **Vercel**: Deployment platform for both web and admin applications
- **Kajabi**: Learning management system integration via webhooks for course completion tracking

### Development Tools
- **Prisma**: ORM and database schema management
- **ESLint + Prettier**: Code quality and formatting
- **Playwright**: End-to-end testing framework
- **Sentry**: Error tracking and performance monitoring (planned)
- **GitHub Actions**: CI/CD with comprehensive validation workflows

### Integration APIs
- **Kajabi Webhook**: Processes course completion events for automatic Learn stage credit
- **LinkedIn**: Manual URL + screenshot submission for Present stage (no API available)
- **Email Service**: Automated notifications for submissions and approvals

### Monitoring and Observability
- **Structured Logging**: Pino-based logging with request correlation
- **Performance Monitoring**: Internal metrics and SLO tracking
- **Security**: Secret scanning, vulnerability scanning with Trivy
- **Health Checks**: Database connectivity and service health monitoring