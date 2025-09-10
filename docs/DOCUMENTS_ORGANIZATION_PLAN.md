## Documentation Organization and Governance Plan

Purpose: Establish an industry-aligned information architecture, governance, and maintenance model for Markdown and docs across the monorepo. No content moves yet; this is a planning document to align scope and approach.

### Scope

- Markdown and doc assets under: `docs/`, `packages/*/**.md`, `apps/*/**.md`, `archive/**.md`, `plan/**.md`, and root `*.md`.
- API Extractor reports (`packages/*/api-reports/*.api.md`) are included only as artifacts to index and exclude from authoring.
- Non-goals: rewriting content, changing technical build; no external dependencies added.

### Goals

- Findability: readers can locate authoritative docs by domain and role (dev, ops, admin, educator).
- Single source of truth: eliminate divergence; mark canonical vs. generated vs. deprecated.
- Standards: consistent front‑matter, titles, link style, and file naming.
- Governance: clear ownership, review flow, and lifecycle (draft → active → deprecated → archived).

---

## 1) Current State (Snapshot)

Observed structure highlights:

- `docs/` contains domain guides (build, logging, security, DB, webhooks, roles, scoring) and a deep `leaps/` subtree for program content.
- Package-local docs under `packages/*` (e.g., `packages/db/docs`, `packages/ui/*`, `packages/security/*`) with package-specific guides and API reports.
- Planning documents under `plan/` and high-level project status docs at repo root (`README.md`, `PROJECT_STATUS.md`, `PHASE_4_SUMMARY.md`).
- API Extractor reports across packages (`api-reports/*.api.md`) are generated and should not be manually edited.

Strengths

- Good topical coverage for build and validation (BUILDING, VALIDATION), logging, DB operations, and LEAPS program.
- Per‑package docs exist where specialization matters.

Gaps/Opportunities

- Mixed placement for similar topics (e.g., build vs. package build notes, deployment guides in multiple places).
- Inconsistent front‑matter and headings; some docs lack clear owner or last‑updated context.
- Generated artifacts intermingled with authored docs in searches, affecting signal/noise.
- Cross‑links exist but lack a canonical index and role‑based entry points.

---

## 2) Information Architecture (Proposed)

Top-level hubs under `docs/`:

- Architecture: high-level system, IA, canonical routing, header composition.
- Build & Tooling: BUILDING, BUILD_QUICK_REFERENCE, BUILD_ARTIFACT_POLICY, Turbo cache, performance, bundle analysis, validation systems.
- Backend & DB: DATABASE, DATABASE_MANAGEMENT, schema, migrations strategy, observability, logging.
- Security & Governance: policies, roles-permissions, CSRF, threat modeling, decision records.
- Product (LEAPS): `docs/leaps/*` remains; add overview and index page with journey map.
- Operations: deployment, Vercel guides, ops & reliability, runbooks.
- API & Integrations: API envelopes, openapi.yaml, integration guides (Kajabi), internal endpoints, webhooks.
- UI & Frontend: UI registry, i18n optimization, RSC/server/client boundaries (if not elsewhere).

Per‑package docs remain adjacent to code for maintainability, with index references from the central hubs.

---

## 3) Conventions and Standards

3.1 File naming

- Kebab-case filenames; avoid spaces; use concise nouns or noun‑phrases (e.g., `error-handling.md`).
- Use directories for multi‑page topics (e.g., `docs/leaps/`).

  3.2 Front‑matter (optional but recommended)

```yaml
---
title: Error Handling Strategy
owner: platform-team
status: active # draft|active|deprecated|archived
last_reviewed: 2025-09-09
tags: [backend, platform]
---
```

3.3 Heading and style

- H2 `##` for top title in files (consistent with internal docs), sentence‑case headings, concise intros, use code backticks for paths and APIs.
- Prefer reference links over inline bare URLs.

  3.4 Link structure

- Relative links within `docs/`; cross‑package links should target the central hub, not deep internal paths.
- Avoid linking to generated `api-reports` files; link to package README or API index instead.

  3.5 Ownership & lifecycle

- Each document declares an owner and status. Owners review quarterly (or on major changes).
- Deprecate before archive: add banner at top with replacement link; move to `archive/` during cleanup windows.

  3.6 Generated vs. Authored

- Mark generated docs (API Extractor) with a banner indicating “do not edit.” Exclude them from authoring workflows and content lint.

---

## 4) Navigation, Indexing, and Entry Points

- `docs/README.md` becomes the canonical index. It:
  - Lists the top-level hubs with short summaries and links.
  - Provides role‑based maps: Developer, Reviewer, Admin, Educator.
  - Includes a search tip section (e.g., repo search, topic tags).
- Sub‑indexes:
  - `docs/leaps/README.md` remains and adds stage-based navigation.
  - Each hub gets a short overview section at the top of its main page (or a dedicated `README.md`).
- Package indexes:
  - Each `packages/<name>/README.md` links back to relevant central hub sections.

---

## 5) Quality Gates and Hygiene

- Add a docs lint pass (no code changes yet):
  - Validate required front‑matter keys when present; allow legacy docs without blocking.
  - Broken link detection within `docs/` (future enhancement).
  - Check title presence and first heading formatting.
- Keep generated `api-reports` excluded from prose linting.

---

## 6) Migration Plan (Phased, No Moves Yet)

Phase 1 – Index and Standards

- Create `docs/README.md` as canonical index (non-invasive).
- Add this plan and a `CONTRIBUTING-DOCS.md` with authoring standards.

Phase 2 – Mark Ownership & Status

- Add front‑matter banners to key living docs (BUILDING, DATABASE, policies, roles) indicating owner and last_reviewed.
- Tag generated docs and package API reports as generated.

Phase 3 – Rationalize Placement

- For topics duplicated across root and `docs/`, choose one canonical location; add redirects/links in the other.
- Move deprecated docs to `archive/` with clear replacement links (requires approval).

Phase 4 – Tooling (Optional)

- Add docs linter for headings/links/front‑matter and a CI check.
- Generate a simple sitemap or table-of-contents index for `docs/`.

---

## 7) Authoring Checklist

- Clear title and purpose
- Owner and status declared (or legacy explicitly marked)
- Uses consistent heading levels and filename style
- Cross-links to central hub pages rather than duplicating content
- Examples reference correct paths/APIs and follow repo build policies

---

## 8) Open Questions

- Which team(s) own the central hubs (Architecture, Build & Tooling, Backend & DB, Security & Governance, Product/LEAPS, Operations, API & Integrations, UI & Frontend)?
- Review cadence preference (quarterly vs. per‑release)?
- Should we add automated link checking and front‑matter validation in CI immediately or after standards adoption?

This plan is documentation‑only. Implementation changes (moves, renames, linting) require explicit approval and will be executed incrementally.



