# GitHub Actions CI/CD Workflows

This document describes the comprehensive CI/CD pipeline implemented for the MS Elevate LEAPS Tracker monorepo.

## Workflow Overview

### 1. **ci.yml** - Main CI Pipeline
**Triggers:** Push to main/staging, PRs to main/staging
**Purpose:** Core continuous integration with comprehensive testing

**Features:**
- **Matrix Testing:** Node.js 18.x and 20.x
- **PostgreSQL Service:** Test database with proper health checks
- **Caching:** pnpm store and Turbo cache optimization
- **Parallel Execution:** lint, type-check, test run concurrently
- **Build Verification:** Both web and admin apps built and artifacts uploaded
- **Security Scanning:** Trivy vulnerability scanner
- **Dependency Audit:** Security audit of all dependencies
- **Test Coverage:** Codecov integration for coverage reporting

**Jobs:**
1. `test` - Linting, type checking, and unit tests
2. `build` - Application building with artifact upload
3. `security-scan` - Trivy security scanning
4. `audit` - Dependency security audit
5. `status-check` - Final status aggregation

### 2. **db-drift-check.yml** - Database Schema Drift Detection
**Triggers:** PRs modifying Prisma schema or migrations
**Purpose:** Prevent schema drift between migrations and schema.prisma

**Features:**
- **Drift Detection:** Uses Prisma migrate diff to detect inconsistencies
- **Migration Validation:** Ensures migration history is consistent
- **PR Comments:** Automatically comments on PRs with drift details
- **Fail Fast:** Prevents merging PRs with schema drift

**Safety Checks:**
- Compares migrations directory with schema.prisma
- Validates migration history integrity
- Provides actionable feedback for resolution

### 3. **secret-scan.yml** - Comprehensive Secret Scanning
**Triggers:** PRs, pushes to main/staging, weekly schedule
**Purpose:** Multi-layered secret detection and prevention

**Tools Integrated:**
- **Gitleaks:** Industry-standard secret scanner
- **Custom Patterns:** Project-specific secret patterns
- **Semgrep:** Advanced semantic analysis
- **TruffleHog:** High-entropy secret detection

**Custom Checks:**
- Hardcoded API keys and passwords
- Environment files with actual values
- URLs with embedded credentials
- Production configuration detection

### 4. **deploy.yml** - Production Deployment Pipeline
**Triggers:** Push to main, manual workflow dispatch
**Purpose:** Automated production deployments with safety checks

**Safety Features:**
- **CI Dependency:** Waits for CI pipeline completion
- **Database Migrations:** Automatic schema deployment
- **Vercel Integration:** Seamless deployment to Vercel
- **Smoke Tests:** Post-deployment health checks
- **Rollback Capability:** Manual workflow dispatch for environments

**Deployment Steps:**
1. Pre-deployment validation
2. Database migration execution
3. Application deployment to Vercel
4. Post-deployment smoke tests
5. Success/failure notifications

### 5. **env-check.yml** - Environment Validation
**Triggers:** Daily schedule, manual dispatch
**Purpose:** Continuous monitoring of production environment health

**Validation Checks:**
- **Environment Variables:** All required variables present and valid
- **Database Connectivity:** PostgreSQL connection and query tests
- **External APIs:** Supabase, Clerk, and webhook endpoint tests
- **SSL Certificates:** Certificate validity and expiration monitoring
- **Service Health:** Application endpoint availability

### 6. **health-check.yml** - Project Health Assessment
**Triggers:** Weekly schedule, manual dispatch
**Purpose:** Comprehensive project structure and code quality monitoring

**Health Metrics:**
- **Project Structure:** Required directories and files
- **Configuration Validation:** package.json, tsconfig.json, Prisma schema
- **Code Metrics:** Component count, API routes, database models
- **File Size Monitoring:** Detection of large files
- **Dependency Health:** Vulnerability and outdated package detection

### 7. **dependabot.yml** - Automated Dependency Management
**Schedule:** Weekly updates on Mondays/Tuesdays
**Purpose:** Automated security updates and dependency maintenance

**Update Strategy:**
- **Root Dependencies:** Weekly updates with major version protections
- **App-Specific:** Separate updates for web and admin apps
- **GitHub Actions:** Weekly action updates
- **Smart Ignoring:** Major version updates require manual review

## Security Features

### Multi-Layer Secret Protection
1. **Gitleaks:** Real-time secret scanning
2. **Custom Patterns:** Project-specific secret detection
3. **Semgrep Rules:** Advanced semantic analysis
4. **TruffleHog:** Entropy-based detection
5. **Manual Patterns:** Custom regex for common secrets

### SARIF Integration
- Security results uploaded to GitHub Security tab
- Centralized vulnerability management
- Integration with GitHub Advanced Security features

### Dependency Security
- **Daily Audits:** Automated vulnerability scanning
- **Update Automation:** Dependabot for security patches
- **Controlled Updates:** Major version changes require approval

## Performance Optimizations

### Caching Strategy
- **pnpm Store:** Persistent dependency caching
- **Turbo Cache:** Build and task result caching
- **Docker Layer:** Multi-stage builds with layer caching
- **Action Cache:** GitHub Actions cache optimization

### Parallel Execution
- **Matrix Builds:** Multiple Node.js versions
- **Concurrent Jobs:** Independent job execution
- **Parallel Tasks:** Turbo-powered parallel task execution

### Resource Management
- **Concurrency Control:** Prevents resource conflicts
- **Cancel in Progress:** Automatic cancellation of superseded runs
- **Selective Triggers:** Path-based and conditional execution

## Monitoring and Reporting

### Status Badges
Comprehensive status badges in README.md:
- CI Pipeline Status
- Deployment Status  
- Database Drift Check
- Secret Scan Status
- Code Coverage

### Notifications
- **PR Comments:** Automated feedback on issues
- **Step Summaries:** Detailed execution reports
- **Slack Integration:** Ready for team notifications (commented)

### Metrics Tracking
- **Build Times:** Performance monitoring
- **Test Coverage:** Coverage trend analysis
- **Security Metrics:** Vulnerability tracking
- **Code Quality:** Complexity and maintainability metrics

## Environment Configuration

### Required Secrets
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth public key
- `CLERK_SECRET_KEY` - Clerk auth secret key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE` - Supabase service role key
- `KAJABI_WEBHOOK_SECRET` - Kajabi webhook validation
- `NEXT_PUBLIC_SITE_URL` - Application public URL
- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Vercel organization ID  
- `VERCEL_PROJECT_ID` - Vercel project ID
- `CODECOV_TOKEN` - Code coverage reporting (optional)

### Environment-Specific Configuration
- **Production:** Full validation and deployment
- **Staging:** Preview deployments with password protection
- **Development:** Local development with mocked services

## Troubleshooting Guide

### Common Issues

#### 1. Database Connection Failures
```bash
# Check DATABASE_URL format
echo $DATABASE_URL | grep -E "^postgresql://"

# Test connection manually
pnpm db:generate && node -e "require('@elevate/db').prisma.$queryRaw\`SELECT 1\`"
```

#### 2. Prisma Schema Drift
```bash
# Generate migration for changes
pnpm db:migrate

# Reset if needed
pnpm db:reset --force
```

#### 3. Build Failures
```bash
# Clear all caches
rm -rf node_modules .turbo .next dist
pnpm install
pnpm build
```

#### 4. Test Failures
```bash
# Run specific test suite
pnpm test -- --testNamePattern="specific test"

# Update snapshots
pnpm test -- --updateSnapshot
```

### Monitoring Commands
```bash
# Check workflow status
gh workflow list

# View recent runs
gh run list --workflow=ci.yml

# Download artifacts
gh run download <run-id>

# View logs
gh run view <run-id> --log
```

## Best Practices

### Branch Protection
- Require status checks before merge
- Require up-to-date branches
- Require PR reviews from code owners
- Dismiss stale reviews on new commits

### Workflow Maintenance
- Regular review of workflow performance
- Update action versions quarterly
- Monitor cache hit rates
- Review and update secret scanning patterns

### Security Practices
- Regular secret rotation
- Principle of least privilege
- Environment segregation
- Audit log monitoring

---

*This CI/CD pipeline is designed to ensure code quality, security, and reliability while maintaining fast feedback loops for developers.*