# 🚀 MS Elevate Indonesia LEAPS Tracker

> Production-ready platform for tracking Indonesian educators' journey through the LEAPS framework (Learn, Explore, Amplify, Present, Shine) as they adopt AI in classrooms.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

## ✨ Features

### For Educators
- **5-Stage LEAPS Journey**: Structured progression through Learn, Explore, Amplify, Present, and Shine
- **Points & Gamification**: Earn points for completing activities, with anti-gaming measures
- **Public Leaderboard**: Top 20 educators showcased with 30-day and all-time views
- **Evidence Submission**: Upload certificates, classroom photos, and documentation
- **Badge System**: Earn achievements for milestones and excellence
- **Bilingual Support**: Full Indonesian (Bahasa) and English localization

### For Administrators
- **Review Queue**: Efficient submission approval/rejection workflow
- **User Management**: Role-based access control (Participant, Reviewer, Admin)
- **Analytics Dashboard**: Real-time metrics and insights
- **Data Exports**: CSV exports for reporting and analysis
- **Kajabi Integration**: Automatic Learn stage crediting via webhooks
- **Email Notifications**: Automated communications via Resend

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage for evidence files
- **Authentication**: Clerk (Google SSO)
- **Email**: Resend with React Email templates
- **Localization**: next-intl (Indonesian/English)
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17 or later
- pnpm 8.0 or later
- PostgreSQL database (Supabase recommended)
- Clerk account for authentication
- Resend account for emails (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/elevate-leaps-tracker.git
   cd elevate-leaps-tracker/elevate
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   cp apps/web/.env.example apps/web/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   ```
   
   Edit the `.env.local` files with your credentials:
   - Database URL from Supabase
   - Clerk keys from dashboard
   - Resend API key (optional)
   - Kajabi webhook secret (if using)

4. **Set up the database**
   ```bash
   pnpm db:setup
   ```
   
   This will:
   - Run Prisma migrations
   - Create materialized views
   - Seed initial data

5. **Start development servers**
   ```bash
   pnpm dev
   ```
   
   - Web app: http://localhost:3000
   - Admin app: http://localhost:3001

## 📁 Project Structure

```
elevate/
├── apps/
│   ├── web/                 # Public site + participant dashboard
│   │   ├── app/             # Next.js app router pages
│   │   ├── components/      # React components
│   │   ├── messages/        # i18n translations (id/en)
│   │   └── public/          # Static assets
│   └── admin/               # Admin console
│       ├── app/             # Admin pages
│       └── components/      # Admin UI components
├── packages/
│   ├── db/                  # Prisma schema & migrations
│   ├── auth/                # RBAC & authentication helpers
│   ├── types/               # Zod schemas & TypeScript types
│   ├── ui/                  # Shared UI components
│   ├── storage/             # Supabase storage utilities
│   ├── emails/              # Email templates
│   └── logic/               # Business logic & scoring
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── seed.sql            # Seed data
├── scripts/                 # Deployment & maintenance scripts
└── docs/                    # Documentation
```

## 🌐 Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select the `elevate` directory as root
   - Configure environment variables

3. **Set environment variables in Vercel**
   - All variables from `.env.local` files
   - Set `NODE_ENV=production`

4. **Deploy**
   ```bash
   pnpm deploy:prod
   ```

### Database Setup (Production)

1. **Create Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Copy connection string

2. **Run migrations**
   ```bash
   pnpm db:deploy production
   ```

3. **Configure storage**
   - Create `evidence` bucket in Supabase Storage
   - Set as private bucket
   - Configure CORS for your domain

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) - Comprehensive project documentation
- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [API Documentation](./docs/api-specs.yaml) - OpenAPI specification
- [Kajabi Integration](./docs/kajabi-integration.md) - Webhook setup guide

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Development servers
pnpm dev              # Start all apps
pnpm dev:web         # Web app only
pnpm dev:admin       # Admin app only

# Database
pnpm db:generate     # Generate Prisma client
pnpm db:push         # Push schema changes
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed database
pnpm db:studio       # Open Prisma Studio

# Build
pnpm build           # Build all apps
pnpm build:web       # Build web app
pnpm build:admin     # Build admin app

# Testing
pnpm lint            # Run linter
pnpm type-check      # TypeScript checks
pnpm test            # Run tests

# Deployment
pnpm deploy:staging  # Deploy to staging
pnpm deploy:prod     # Deploy to production
```

## 🌟 Key Features Implementation

### LEAPS Framework
- **Learn** (20 pts): Certificate upload or Kajabi auto-credit
- **Explore** (50 pts): Classroom AI application evidence
- **Amplify** (2 pts/peer, 1 pt/student): Training documentation
- **Present** (20 pts): LinkedIn post with screenshot
- **Shine** (Recognition): Innovation ideas submission

### Anti-Gaming Measures
- Maximum 50 peers, 200 students per Amplify submission
- 7-day rolling submission limits
- Duplicate certificate detection
- Bounded point adjustments (±20%)
- Append-only audit trail

### Security Features
- Row Level Security (RLS) policies
- File type/size validation (PDF/JPG/PNG, max 10MB)
- Signed URLs with 1-hour TTL
- RBAC with 4-tier hierarchy
- CSRF protection
- Input sanitization

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Microsoft Indonesia for the Elevate program
- Indonesian educators embracing AI in education
- Open source community for the amazing tools

---

**Built with ❤️ for Indonesian educators**