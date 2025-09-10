## Documentation Index

This is the canonical entry point for documentation across the monorepo. Use the hubs below or the role-based map to navigate. Generated API report files are not intended for manual edits.

### Role-based quick links

- **New Engineers**: [`onboarding.md`](./onboarding.md), [`development.md`](./development.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Developers**: [`development.md`](./development.md), [`api/index.md`](./api/index.md), [`architecture/overview.md`](./architecture/overview.md), [`BUILDING.md`](../BUILDING.md)
- **Reviewers**: [`leaps/reviewer-rubric.md`](./leaps/reviewer-rubric.md), [`security/index.md`](./security/index.md), [`roles-permissions.md`](./roles-permissions.md)
- **Operators/Admins**: [`runbooks/deploy.md`](./runbooks/deploy.md), [`security/index.md`](./security/index.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md), [`LOGGING.md`](./LOGGING.md)
- **Educators/Program**: [`leaps/README.md`](./leaps/README.md), [`points-and-badges.md`](./points-and-badges.md), [`leaps/amplify.md`](./leaps/amplify.md)

---

## Hubs

### Architecture

- [`architecture/overview.md`](./architecture/overview.md) - System design and architecture
- [`architecture/adr/`](./architecture/adr/) - Architecture Decision Records
- [`ia.md`](./ia.md) - Information architecture
- [`canonical-routing-strategy.md`](./canonical-routing-strategy.md)
- [`HEADER_COMPOSITION.md`](./HEADER_COMPOSITION.md)

### Build & Tooling

- [`BUILDING.md`](../BUILDING.md)
- [`BUILD_QUICK_REFERENCE.md`](./BUILD_QUICK_REFERENCE.md)
- [`BUILD_ARTIFACT_POLICY.md`](./BUILD_ARTIFACT_POLICY.md)
- [`TURBO_CACHE.md`](./TURBO_CACHE.md), [`TURBO_REMOTE_CACHE.md`](./TURBO_REMOTE_CACHE.md)
- [`bundle-analysis.md`](./bundle-analysis.md), [`PERFORMANCE_OPTIMIZATION_REPORT.md`](./PERFORMANCE_OPTIMIZATION_REPORT.md)
- [`VALIDATION_SYSTEMS.md`](../VALIDATION_SYSTEMS.md), [`api-coverage-validation.md`](./api-coverage-validation.md)
- [`type-safety.md`](./type-safety.md), [`rca-text-lint-and-type-safety.md`](./rca-text-lint-and-type-safety.md)

### Backend & Database

- [`DATABASE.md`](./DATABASE.md), [`database-management.md`](./database-management.md)
- [`schema.sql`](./schema.sql), [`MATERIALIZED_VIEWS_OPTIMIZATION.md`](./MATERIALIZED_VIEWS_OPTIMIZATION.md)
- [`OBSERVABILITY_SETUP.md`](./OBSERVABILITY_SETUP.md), [`logging-best-practices.md`](./logging-best-practices.md), [`LOGGING.md`](./LOGGING.md)
- [`error-handling.md`](./error-handling.md), [`INTERNAL_ENDPOINTS.md`](./INTERNAL_ENDPOINTS.md)

### Security & Governance

- [`security/index.md`](./security/index.md) - Complete security guide
- [`policies.md`](./policies.md) - Privacy policies
- [`roles-permissions.md`](./roles-permissions.md) - RBAC implementation
- [`csrf-protection.md`](./csrf-protection.md) - CSRF protection
- [`decisions.md`](./decisions.md)

### Product (LEAPS)

- Overview: [`leaps/README.md`](./leaps/README.md)
- Key topics: [`leaps/submissions-fsm.md`](./leaps/submissions-fsm.md), [`leaps/reviewer-rubric.md`](./leaps/reviewer-rubric.md), [`leaps/stats-and-counters.md`](./leaps/stats-and-counters.md), [`leaps/privacy-and-retention.md`](./leaps/privacy-and-retention.md), [`leaps/monitoring-and-slos.md`](./leaps/monitoring-and-slos.md), [`leaps/kajabi-learn.md`](./leaps/kajabi-learn.md)

### Operations

- [`runbooks/deploy.md`](./runbooks/deploy.md) - Deployment procedures
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Deployment guide
- Reliability: [`leaps/ops-and-reliability.md`](./leaps/ops-and-reliability.md)
- _(Deprecated guides moved to [`../archive/deprecated-docs/`](../archive/deprecated-docs/))_

### API & Integrations

- [`api/index.md`](./api/index.md) - Complete API usage guide
- [`API_ENVELOPES.md`](./API_ENVELOPES.md) - Response envelope patterns
- OpenAPI: [`openapi.yaml`](./openapi.yaml)
- Integrations: [`kajabi-integration.md`](./kajabi-integration.md), [`webhooks/kajabi.md`](./webhooks/kajabi.md)

### UI & Frontend

- [`ui-registry.md`](./ui-registry.md)
- [`i18n-bundle-optimization-summary.md`](./i18n-bundle-optimization-summary.md)
- Package docs: [`packages/ui/README.md`](../packages/ui/README.md), [`packages/ui/TAILWIND_SETUP.md`](../packages/ui/TAILWIND_SETUP.md)

### Agents Guides

- Root agents index: [`../AGENTS.md`](../AGENTS.md)
- Admin app agents guide: [`../apps/admin/agents.md`](../apps/admin/agents.md)
- Web app agents guide: [`../apps/web/agents.md`](../apps/web/agents.md)

---

## Generated Documentation (Do not edit)

- API Extractor reports live under each package: `packages/*/api-reports/*.api.md` (source of truth for public APIs). Update via `api:extract`. Do not hand-edit.

## Contributing to Docs

- See [`CONTRIBUTING-DOCS.md`](./CONTRIBUTING-DOCS.md) for standards (front‑matter, naming, ownership, lifecycle, links).
- See [`SITEMAP.md`](./SITEMAP.md) for a comprehensive index of all documentation files.

## Validation & Maintenance

- Run `pnpm run verify:docs` to validate documentation standards
- Run `pnpm run docs:sitemap` to regenerate the documentation sitemap
