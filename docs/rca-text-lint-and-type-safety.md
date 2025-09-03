# RCA: Text/Lint Noise and Type-Safety Drift

## Summary
- Massive “text string”/markdown errors and noisy Problems pane made the repo hard to work with; agents also reported type-safety success inconsistently.
- Fixes: workspace-level VS Code settings, cspell and markdownlint configs; stricter ESLint/TS + CI gates; schema-first validation at boundaries.

## Impact
- Developer friction: 2k+ false-positives in Problems tab (docs, emojis, proper nouns).
- Risk of type regressions from `as any`/unvalidated JSON usage.

## Root Causes
1) Editor extensions without workspace config
   - SpellRight and Markdown All in One flagged normal prose/emojis as problems.
   - No shared cspell dictionary; markdownlint used strict defaults.

2) Missing universal gates for type safety
   - Some code paths used `Record<string, unknown>`/`as any` beyond boundaries.
   - CI lacked a dedicated “type-safety” check earlier; local lint rules weren’t strictly enforced everywhere.

## What Fixed It (and Where)
- Workspace settings (committed)
  - `.vscode/settings.json` and `elevate.code-workspace` disable spell check/lint for markdown at workspace-level to avoid false-positives.
  - Problem decorations limited for markdown files.

- Spell checker and markdown lint
  - `cspell.json` with project terminology and disabled by default.
  - `.markdownlint.json` relaxed problematic rules (long lines, HTML snippets, headings at top).

- Type safety governance
  - ESLint (`eslint.config.mjs`):
    - `@typescript-eslint/no-explicit-any`, `no-unsafe-*` rules set to error.
  - CI (`.github/workflows/type-safety.yml`):
    - Runs `pnpm type-check`, `pnpm type-safety:strict`, and types package tests.
  - Package scripts (`package.json`):
    - `type-safety:check`, `type-safety:strict` wired to a checker script.

- Schema-first boundaries
  - Zod parsers: `parseRole`, `parseActivityCode`, discriminated `SubmissionPayloadSchema`.
  - Prisma JSON writes via `toPrismaJson()`; audit/meta DTOs validated before insert.

## Prevention (Policies)
1) Editor/Docs
   - Keep `.vscode/settings.json`, `cspell.json`, `.markdownlint.json` under version control.
   - Do not override workspace settings locally unless debugging.

2) Type Safety
   - Unknown is allowed only at I/O boundaries (requests, webhooks, DB JSON reads).
   - Immediately validate with Zod and export inferred types; never let `unknown` or `Record<string, unknown>` propagate.
   - All JSON writes use `toPrismaJson()`; reads are parsed to DTOs near the data layer.
   - Enum/string inputs go through parser helpers (no casts).

3) CI Gates
   - Keep `pnpm type-safety:strict` mandatory on PRs.
   - Lint must pass with zero `any`/unsafe violations.
   - Grep guard (optional): fail PR if `as any` appears outside whitelisted files.

## Runbook (If It Happens Again)
1) Problems pane flooded with markdown/spell issues
   - Verify `.vscode/settings.json` is present and loaded.
   - Ensure `cspell.json` and `.markdownlint.json` exist at repo root (elevate/).
   - Reload VS Code window (Developer: Reload Window).

2) Type-safety failures/regressions
   - Run `pnpm lint` and `pnpm type-safety:strict` to surface violations.
   - Check for new usages of `as any` or `Record<string, unknown>` in app routes/pages.
   - Add/extend Zod schemas; replace casts with parsers; use DTOs and helpers.

## Verification Checklist
- Editor shows no flood of markdown/spell errors on clean checkout.
- `pnpm lint` passes with strict TS rules.
- `pnpm type-safety:strict` passes in CI and locally.
- Grep checks:
  - `rg "as any"` → 0 matches outside docs/tooling.
  - `rg "Record<string, unknown>" apps/` → 0 matches in app routes/pages.

## References
- VS Code: `.vscode/settings.json`, `elevate.code-workspace`
- Spell/Markdown: `cspell.json`, `.markdownlint.json`
- CI: `.github/workflows/type-safety.yml`
- ESLint: `eslint.config.mjs`
- Types/Parsers: `packages/types/src/common.ts`, `packages/types/src/submission-payloads.ts`
- JSON helpers: `toPrismaJson()` in `packages/types/src/common.ts`


