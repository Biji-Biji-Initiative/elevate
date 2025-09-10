## Contributing to Documentation

This guide defines authoring standards for Markdown docs across the monorepo. Follow these rules to keep docs discoverable, consistent, and reliable. Do not change build/config without approval.

### Before You Start

- Check the canonical index: [`docs/README.md`](./README.md). If a topic exists, update it instead of creating a duplicate.
- For package‑specific guidance, place docs next to code (e.g., `packages/db/docs/`) and add a link from the central hub.

### File Naming

- Use kebab‑case filenames (e.g., `error-handling.md`).
- Prefer directories for multi‑page topics (e.g., `docs/leaps/`).

### Front‑matter (recommended)

```yaml
---
title: <Concise descriptive title>
owner: <team-or-owner>
status: draft # draft|active|deprecated|archived
last_reviewed: 2025-09-10
tags: [topic, area]
---
```

### Structure and Style

- Start with an H2 `## Title` inside the document; keep intros short.
- Use backticks for code, file paths, APIs, and commands.
- Prefer relative links; avoid bare URLs—use markdown links with descriptive text.
- Include a small “Scope” or “Purpose” section near the top.

### Cross-linking

- Link to hub pages in `docs/README.md` where applicable.
- For generated API reports, link to the package README or API section, not directly to `api-reports/*.api.md`.

### Ownership and Lifecycle

- The `owner` maintains the doc and reviews quarterly or when major changes land.
- To deprecate: add a banner at the top indicating replacement, and set `status: deprecated`. Archival moves to `archive/` happen in planned cleanups.

### Generated vs. Authored

- API Extractor reports (`packages/*/api-reports/*.api.md`) are generated and must not be edited by hand. Update via `pnpm run api:extract`.

### PR Checklist

- [ ] File follows naming and structure conventions
- [ ] Front‑matter present or intentionally omitted for legacy
- [ ] Linked from the appropriate hub or package README
- [ ] No duplication of canonical content
- [ ] Examples and paths conform to BUILDING.md policies

