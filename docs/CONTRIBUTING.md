---
title: Contribution Guide
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [contributing, development, documentation, pr-template]
---

## Contribution Guide

Complete guide for contributing to the MS Elevate LEAPS Tracker project, including code, documentation, and review processes.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Completed the [Engineering Onboarding](./onboarding.md)
- Read the [Core Developer Guide](./development.md)
- Understood the [Architecture Overview](./architecture/overview.md)
- Set up your local development environment

### Types of Contributions

- **Bug Fixes**: Resolve issues or improve existing functionality
- **Features**: Add new capabilities or enhance user experience
- **Documentation**: Improve guides, fix typos, add examples
- **Tests**: Increase test coverage or improve test quality
- **Performance**: Optimize code, queries, or build processes
- **Refactoring**: Improve code structure without changing behavior

## Code Contribution Process

### 1. Issue Creation

Before starting work:

- **Check existing issues** to avoid duplicates
- **Create an issue** describing the problem or feature
- **Get approval** from maintainers for significant changes
- **Assign yourself** to the issue when ready to work

### 2. Branch Strategy

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

**Branch Naming:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 3. Development Workflow

```bash
# Make your changes
# ... edit files ...

# Run validation frequently
pnpm verify:all

# Test your changes
pnpm test
pnpm test:e2e

# Build and verify
pnpm build:verify
```

### 4. Commit Standards

Use conventional commits for clear history:

```bash
# Format: type(scope): description
git commit -m "feat(auth): add role-based access control"
git commit -m "fix(db): resolve migration rollback issue"
git commit -m "docs(api): update endpoint documentation"
git commit -m "test(ui): add component integration tests"
```

**Types:**

- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `test` - Test additions/changes
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `chore` - Build/tooling changes

### 5. Pull Request Creation

Create a PR when your changes are ready for review:

```bash
# Push your branch
git push origin feature/your-feature-name

# Create PR via GitHub interface
```

## Pull Request Template

Use this template for all PRs:

```markdown
## Description

Brief description of what this PR does and why.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)
- [ ] Test improvements

## Testing

- [ ] Unit tests pass (`pnpm test:unit`)
- [ ] Integration tests pass (`pnpm test:integration`)
- [ ] E2E tests pass (`pnpm test:e2e`)
- [ ] Manual testing completed
- [ ] New tests added for new functionality

## Validation

- [ ] Code builds successfully (`pnpm build`)
- [ ] All validation checks pass (`pnpm verify:all`)
- [ ] TypeScript compilation succeeds (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No new security vulnerabilities

## Database Changes

- [ ] No database changes
- [ ] Schema changes include migration
- [ ] Migration tested locally
- [ ] Seed data updated if needed
- [ ] Migration is backwards compatible

## Documentation

- [ ] No documentation needed
- [ ] Documentation updated in this PR
- [ ] Documentation will be updated in follow-up PR
- [ ] API documentation updated (if applicable)

## Security Considerations

- [ ] No security implications
- [ ] Security review completed
- [ ] No new PII handling
- [ ] Access controls verified
- [ ] Input validation added

## Performance Impact

- [ ] No performance impact
- [ ] Performance tested locally
- [ ] Database queries optimized
- [ ] Bundle size impact acceptable
- [ ] Caching strategy considered

## Deployment Notes

- [ ] No special deployment requirements
- [ ] Environment variables need updating
- [ ] Database migration required
- [ ] Feature flags needed
- [ ] Rollback plan documented

## Screenshots/Videos

<!-- Add screenshots for UI changes -->

## Related Issues

Closes #[issue-number]
Related to #[issue-number]

## Checklist

- [ ] I have read the [Contribution Guide](./CONTRIBUTING.md)
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## Code Standards

### TypeScript Guidelines

```typescript
// Use strict typing
interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

// Prefer type guards over type assertions
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' && obj !== null && 'id' in obj && 'email' in obj
  )
}

// Use enums for constants
enum UserRole {
  PARTICIPANT = 'participant',
  REVIEWER = 'reviewer',
  ADMIN = 'admin',
}
```

### Import/Export Rules

```typescript
// ✅ Correct - use published exports
import { Button } from '@elevate/ui'
import { auth } from '@elevate/auth'

// ❌ Wrong - never import from src/ or dist/
import { Button } from '@elevate/ui/src/components/Button'
import { auth } from '@elevate/auth/dist/index'
```

### Error Handling

```typescript
// Use structured error handling
import { createErrorResponse } from '@elevate/http'

export async function POST() {
  try {
    const result = await riskyOperation()
    return createSuccessResponse(result)
  } catch (error) {
    logger.error('Operation failed', { error })
    return createErrorResponse(
      'OPERATION_FAILED',
      'Failed to complete operation',
    )
  }
}
```

### Database Patterns

```typescript
// Use Prisma client safely
async function getUser(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      // Don't select sensitive fields unless needed
    },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  return user
}
```

## Documentation Standards

### File Organization

```
docs/
├── README.md              # Central index
├── development.md         # Core dev guide
├── onboarding.md         # New hire guide
├── architecture/         # System design
│   ├── overview.md
│   └── adr/             # Decision records
├── api/                 # API documentation
├── runbooks/           # Operations guides
└── security/           # Security & privacy
```

### Writing Guidelines

#### Front-matter

All documentation should include front-matter:

```yaml
---
title: Descriptive Title
owner: team-name
status: active # draft|active|deprecated|archived
last_reviewed: 2025-09-10
tags: [relevant, tags]
---
```

#### Structure

````markdown
## Document Title

Brief introduction paragraph explaining purpose and scope.

### Main Section

Content organized with clear headings and subsections.

#### Subsection

Use code blocks for examples:

```bash
pnpm install
pnpm dev
```
````

### Cross-references

Link to related documentation:

- [Development Guide](./development.md)
- [API Documentation](./api/index.md)

````

#### Style Guidelines

- **Headings**: Use H2 (`##`) for main sections, H3 (`###`) for subsections
- **Code**: Use backticks for inline code, code blocks for examples
- **Links**: Use descriptive link text, prefer relative paths
- **Lists**: Use `-` for unordered lists, `1.` for ordered lists
- **Emphasis**: Use `**bold**` for important terms, `*italic*` for emphasis

### Documentation Review

All documentation changes should:

1. **Follow standards** defined in this guide
2. **Pass validation** with `pnpm verify:docs`
3. **Include accurate examples** that work with current codebase
4. **Link appropriately** to related documentation
5. **Update indexes** when adding new documents

## Review Process

### Code Review Guidelines

**For Authors:**
- Ensure PR template is complete
- Respond to feedback promptly
- Make requested changes in new commits (don't force push)
- Resolve conversations when addressed

**For Reviewers:**
- Review within 24 hours for urgent changes
- Focus on correctness, security, and maintainability
- Provide constructive feedback with examples
- Approve when satisfied with changes

### Review Checklist

**Functionality:**
- [ ] Code does what it's supposed to do
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance is acceptable

**Code Quality:**
- [ ] Code is readable and well-structured
- [ ] Follows project conventions
- [ ] No code duplication
- [ ] Appropriate abstractions

**Security:**
- [ ] Input validation is present
- [ ] Authentication/authorization is correct
- [ ] No sensitive data exposure
- [ ] SQL injection prevention

**Testing:**
- [ ] Adequate test coverage
- [ ] Tests are meaningful
- [ ] Tests pass consistently
- [ ] Manual testing completed

## Release Process

### Versioning

The project uses semantic versioning:

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backwards compatible
- **Patch** (0.0.1): Bug fixes, backwards compatible

### Deployment

Deployments happen automatically:

- **Staging**: On PR creation (Vercel preview)
- **Production**: On merge to `main` branch

### Hotfixes

For critical production issues:

1. Create hotfix branch from `main`
2. Make minimal fix
3. Fast-track review process
4. Deploy immediately after merge

## Getting Help

### Resources

- **Documentation**: Start with [`docs/README.md`](./README.md)
- **Development**: See [`development.md`](./development.md)
- **Architecture**: Review [`architecture/overview.md`](./architecture/overview.md)
- **Onboarding**: Follow [`onboarding.md`](./onboarding.md)

### Communication

- **Questions**: Create GitHub discussions
- **Bugs**: Create GitHub issues with reproduction steps
- **Features**: Discuss in issues before implementing
- **Urgent**: Contact team leads directly

### Troubleshooting

```bash
# Check everything is working
pnpm verify:all

# Common fixes
pnpm build:clean          # Clean build
pnpm db:reset            # Reset database
rm -rf node_modules && pnpm install  # Fresh dependencies
````

## Recognition

Contributors are recognized through:

- **GitHub**: Automatic contributor listing
- **Changelog**: Major contributions noted in releases
- **Team**: Recognition in team meetings and updates

Thank you for contributing to the MS Elevate LEAPS Tracker! 🚀

---

_This guide is updated regularly. Please suggest improvements based on your contribution experience._
