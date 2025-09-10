---
title: 'ADR-0001: Monorepo Structure'
owner: platform-team
status: proposed
last_reviewed: 2025-09-10
tags: [adr, monorepo, architecture]
---

## ADR-0001: Monorepo Structure

Decision stub. This ADR will document rationale and constraints for the apps/ + packages/ monorepo, build system (Turbo, tsup), and publishing.

- Context: Next.js apps (web, admin) and ESM-only packages.
- Decision: Keep monorepo with strict package boundaries and exports-only consumption.
- Consequences: Enforced import rules, validation scripts integrated in CI.

