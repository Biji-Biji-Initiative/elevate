# Build Strategy and Package Architecture (Production-Grade Blueprint)

This document is the authoritative blueprint for building, publishing, and consuming packages in this monorepo. It codifies long-term decisions and guardrails used by modern teams at scale.

## 1) Solution-Style TypeScript (single source of truth for type safety)

- Root `tsconfig.json` is a solution with project references only; no `include`.
- Each package has two tsconfigs:
  - `tsconfig.json` (editor): `noEmit: true`, `composite: true`, `rootDir: src`, `include: ["src/**/*"]`.
  - `tsconfig.build.json` (build): `composite: true`, `emitDeclarationOnly: true`, `declaration: true`, `declarationMap: true`, `declarationDir: dist/types`, `rootDir: src`, `stripInternal: true`, `inlineSources: true`.
- Root `tsconfig.base.json` settings for libraries: `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`, `verbatimModuleSyntax: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`.
- Run `tsc -b` at the root to typecheck the entire workspace in dependency order. Do not use `--force` in normal builds; trust `.tsbuildinfo`.

## 2) Package Output Model (two-stage, deterministic artifacts)

- Stage 1 (types): `tsc -b tsconfig.build.json` emits `.d.ts` and `.d.ts.map` to `dist/types/` only.
- Stage 2 (JS): `tsup` emits ESM JavaScript to `dist/js/` using entries declared in `tsup.config.ts`.
- Important:
  - `tsup.config.ts` is the single source of truth for entry points when we bundle; keep entries minimal and public.
  - Use separate outDirs: types → `dist/types`, JS → `dist/js`. This guarantees `clean: true` cannot delete declarations.
  - `dts: false` in `tsup` (types come only from Stage 1). Enable `sourcemap: true` and publish `.map` files for better consumer debugging.
  - Never emit CommonJS; see stance below.

## 3) Module System Stance (ESM-only by default)

- All libraries are ESM-only: `"type": "module"`, export only the `"import"` condition.
- Add Node support statement: `"engines": { "node": ">=20.11" }`.
- Applications may use Next’s defaults; libraries never publish CJS.
- If a dual package is ever required, it must be explicitly proposed and tested across consumers before adoption.

## 4) Exports, Public Surface, and RSC Boundaries

- Only export from `dist/`. Never export raw TS.
- Prefer a small, documented public surface (`package.json` `exports` subpaths only for supported entry points).
- Include `types` per subpath and `typesVersions` for editors:
  - `"types": "./dist/types/index.d.ts"` per package.
  - `"typesVersions": { "*": { "*": ["dist/types/*"] } }`.
- Next 15 + React 19 server/client boundaries:
  - Server-safe entry (default) at `"."`.
  - Client-only subpaths are plain files that begin with `"use client"` and are exported via the standard `"import"` condition (do not invent client-only export conditions).
  - Optionally use the `"react-server"` condition for server-only helpers if strictly necessary.
  - Place `"use client"` only at the top of true client entry files; never via global banners.

## 5) Peer Dependencies, Externals, and Hoisting Guardrails

- Libraries declare `peerDependencies` for `react`, `react-dom`, and where applicable `next`; pin ranges compatible with the repo (`^19` / `^15`).
- Libraries set `sideEffects: false` (or `sideEffects: ["*.css"]` for UI packages that import CSS) and `files: ["dist/js", "dist/types", "README.md", "LICENSE", "dist/js/**/*.map"]`.
- `tsup` `external`: `react`, `react-dom`, `react/jsx-runtime`, `next`, `next/navigation` (and any other framework/runtime peers).
- Root PNPM guardrails:
  - `.npmrc`: `strict-peer-dependencies=true` and `public-hoist-pattern[]=react`, `public-hoist-pattern[]=react-*`, `public-hoist-pattern[]=next`.
  - Root `package.json` `pnpm.peerDependencyRules.allowedVersions` ensures a single acceptable React/Next.

## 6) ESM Import Hygiene (.js extensions)

- With `moduleResolution: bundler` and `verbatimModuleSyntax: true`, relative ESM imports in source must include `.js` extensions (e.g., `import { x } from './util.js'`).
- Enforce via lint rule (import/extensions) and avoid runtime rewrite steps. TS path mapping is for editor ergonomics only.

## 7) Turbo Pipeline (cache-friendly DAG)

- Split build graph to maximize cache hits and correctness:
  - `typecheck`: outputs `packages/*/tsconfig.tsbuildinfo`.
  - `build:types`: depends on `^typecheck`, outputs `packages/*/dist/types/**`.
  - `build:js`: depends on `build:types`, outputs `packages/*/dist/**`.
  - `build`: depends on `build:js`.
- Apps can depend on `^build` as needed; keep `globalEnv` minimal and declared in `turbo.json`.

## 8) API Stability and Lockfiles

- Each library integrates API Extractor to lock public types:
  - Scripts: `api:extract` (local) and `api:check` (diagnostics/CI).
  - Commit `.api.md` reports; CI fails on drift.
- Type safety is enforced by `tsc -b` at the root and strict ESLint rules for libraries. CI maps API diffs to required Changesets bumps (major/minor/patch) and fails if a breaking diff lacks a corresponding major changeset.

## 9) Consumer Verification (fixtures)

- Add `fixtures/consumer-next15` (and/or `fixtures/consumer-node`) that imports every public subpath (server + client) and compiles/builds.
- CI gates: run `tsc --noEmit` in the fixture and a minimal Next build (for RSC conditions).
- Add `fixtures/consumer-node` (pure Node ESM) to verify server/batch usage on Node 20+.
- For local dev ergonomics (optional), apps may set `transpilePackages: ['@elevate/ui','@elevate/auth']` in `next.config.ts`.

## 10) Drift Prevention (entries ↔ exports, stale artifacts)

- Validate `tsup` entries match `package.json` `exports` subpaths via a repo script (e.g., `scripts/validate-exports.mjs`). CI fails on mismatch.
- Because `clean: true` is used and types live in `dist/types/`, stale artifact risk is eliminated. Renamed/removed entries are caught by the validator.
- Prefer a single owner of truth. Either:
  - Generate `exports` from `tsup` entries at build time, or
  - Invert: declare `exports` and generate `tsup` entries. Choose one approach per package and enforce via the validator.

## 11) Path Resolution and Imports

- `tsconfig.base.json` maps `@elevate/*` to `packages/*/src/*` for editor ergonomics only.
- In code, import via published package subpaths (e.g., `@elevate/ui`, `@elevate/ui/FileUpload`). Do not import deep internals.
- Enforce via lint rules (`no-restricted-imports` or `eslint-plugin-boundaries`) to block `@elevate/*/src/*` and internal dist paths.

## 12) Linting and Type Safety Guardrails

- Libraries (packages/*): strict rules as errors (no-unsafe-*, no-explicit-any, consistent-type-imports, etc.).
- Applications (apps/*): progressive hardening; keep dangerous patterns as errors (e.g., `no-floating-promises`).
- Node config files (next/postcss/tailwind) may use Node globals and CJS where needed; do not publish them.
- Enforce ESM .js extensions for relative imports and block deep internal imports.

## 13) CI Sequence (make regressions undeniable)

- Suggested root scripts:
  - `typecheck:build`: `tsc -b`
  - `build`: `turbo run build`
  - `verify:exports`: `node scripts/validate-exports.mjs`
  - `verify:consumer`: `pnpm -C fixtures/consumer-next15 run build`
  - `api:extract`: `turbo run api:extract`
  - `ci`: `pnpm run typecheck:build && pnpm run build && pnpm run verify:exports && pnpm run verify:consumer && pnpm -r run api:extract`

## 14) Optional Strategy: Unbundled Libraries (contrarian, but industry-proven)

- If we choose to unbundle, ship per-file `ESNext` with `bundle: false` and `preserveModules` (via tsup), still ESM-only, with types in `dist/types/`.
- Pros: zero bundler surprises, perfect stack traces, small diffs; Cons: more output files. Decide per package.

## 15) Testable Checkpoints

- One React instance across apps: resolving `react` yields the same path.
- No stale files after renames: `dist/` contains only current entries; `verify:exports` passes.

## 16) Leaderboard Refresh (Cron)

- Materialized views power the leaderboard. Refresh them on a schedule using Vercel Cron or similar:
  - Endpoint: `GET /api/cron/refresh-leaderboards` with `Authorization: Bearer $CRON_SECRET`.
  - Sets: `CRON_SECRET` in the environment.
  - The job calls `refresh_leaderboards()` and performs light maintenance (old audit logs cleanup).

- Consumer fixture builds and imports all public subpaths (server+client).
- API Extractor reports unchanged unless intentionally modified.
- Editor jump-to-def from consumer lands in `.d.ts` with working sourcemaps.
- Edge smoke: An `edge` runtime route importing server-safe entries builds (no Node built-ins leaked).

## 16) Conventions for New Code / Changes

- Sources live under `src/` in each package.
- New public modules require both a `tsup` entry (or a generated one) and an `exports` subpath, plus types mapping.
- `@elevate/types` is foundational and must not import other workspace packages.
- Map to/from Prisma enums at the DB boundary only.
- Prefer zod parsing for external/untyped data; avoid `as any`.

## 17) Releases (versioning, provenance, smoke publish)

- Versioning via Changesets: PR-driven `changeset` files, automated versioning and changelogs.
- Provenance and publish config: `"publishConfig": { "access": "public", "provenance": true }`.
- Smoke publish with Verdaccio: pack and install the tarball in fixtures instead of workspace linking; verify only `dist/js`, `dist/types`, and maps are included.
- Include `"exports": { "./package.json": "./package.json" }` metadata for tooling.

## Quick Commands

- Typecheck solution: `pnpm -C elevate run typecheck:build`
- Build libraries: `pnpm -C elevate -r --filter "@elevate/*" run build`
- Build apps with Turbo: `turbo run build --filter=web...` (and admin accordingly)

This document is the source of truth. Coding agents and contributors must follow it to prevent drift.
