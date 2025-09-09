## Scripts Management Plan and Operating Model

Purpose: Establish a consistent, safe, and industry‑aligned approach for creating, organizing, running, validating, and evolving all repository scripts without changing any existing scripts yet. This plan reflects current state, highlights gaps, and defines standards to prevent drift while aligning with BUILDING.md and VALIDATION_SYSTEMS.md.

### Scope

- Scripts in `scripts/` and subfolders (`db`, `env`, `dev`, `secrets`, `utils`, deploy/build/validate helpers) used locally and in CI/CD.
- Both Bash (`.sh`) and Node ESM (`.mjs`/`.js`) scripts.
- Non‑goals: Implementing refactors or changing behavior now; adding dependencies; changing build system.

### Guiding Principles

- Safety first: default to read‑only, require explicit confirmation for destructive actions.
- Deterministic and idempotent: re‑runs produce the same effect or safely no‑op.
- Single source of truth: keep logic centralized and avoid duplication; re‑use helpers.
- CI‑friendly: non‑interactive by default; clear exit codes; stable text output.
- Align to BUILDING.md: two‑stage builds, dist‑only artifacts, ESM‑only libraries, import/exports guardrails.
- Minimal surface area: small, composable scripts with clear inputs/outputs.

---

## 1) Current State (Audit Snapshot)

Observed (not exhaustive):

- Top‑level helpers: `clean-build.sh`, `build-policy-check.js`, deployment scripts (`deploy-*.sh`, `vercel-deploy.js`, `verify-vercel-config.js`).
- Validation suite: `validate-all.mjs`, `validate-exports.mjs`, `validate-imports.mjs`, `validate-code-quality.mjs`, `lint-fix-verify.mjs`.
- Env helpers: `env/` (`enforce-root-env.mjs`, `exec-dev-with-root-env.mjs`, `sync-db-env-to-prisma.mjs`), `env-check.sh`.
- DB helpers: `db/` (`check-drift.sh`, `generate-migrations.sh`, `sync-supabase.sh`, `init.sql`, `README.md`).
- Dev utilities: `dev/` (`test-db.js`, `test-prisma.mjs`, `test-redaction.js`).
- Secrets: `secrets/` (setup/rotate/vault manager).
- Utilities: `utils/logger.{js,mjs}`.

Strengths

- Strong validation strategy aligning with BUILDING.md; clear drift prevention (imports/exports, dist‑only policy, API Extractor).
- Bash uses `set -euo pipefail` (e.g., `clean-build.sh`); Node scripts already ESM with colored output and path resolution.
- Clear separation by concern (`db`, `env`, `secrets`, `dev`).

Gaps/Opportunities

- Mixed file types (`.js` and `.mjs`) for Node ESM; standardize extensions and shebangs.
- Inconsistent CLI UX across scripts (flags, `--help`, `--dry-run`, `--yes`).
- Non‑uniform logging (colors/symbols) and exit codes; a shared logger exists but not consistently leveraged.
- Some scripts assume interactivity (e.g., logins) without an explicit non‑interactive mode for CI.
- Naming/metadata conventions (header, usage, examples) vary.

---

## 2) Industry Baseline (What “Good” Looks Like)

- Bash best practices: `#!/usr/bin/env bash`, `set -euo pipefail`, `IFS=$'\n\t'` when iterating, `trap` cleanup, explicit `return`/`exit` codes.
- Node best practices: ESM‑only (`type: module`), top‑level `import`, explicit path resolution with `fileURLToPath`, structured CLI parsing, JSON output option for CI when relevant.
- CLI conventions: `--help`/`-h`, `--dry-run` for preview, `--yes` or `--no-confirm` for destructive ops, `--verbose`, `--quiet`.
- Output: consistent prefixes, colored human output by default, `--json` for machine output (no ANSI), stable key names.
- Safety: non‑interactive default in CI; rate‑limit and retry policies for networked tasks; secret redaction in logs.
- Idempotency: guard writes with checks; when in doubt, write to temp locations and swap atomically.
- Documentation: every script self‑documents usage and examples; centralized `scripts/README.md` links.

---

## 3) Repository‑Aligned Standards (to Adopt, No Changes Yet)

3.1 File Types and Shebangs

- Bash: `#!/usr/bin/env bash` + `set -euo pipefail` + `trap` for cleanup; mark executable.
- Node: `.mjs` for ESM scripts; keep `#!/usr/bin/env node` if directly executed; prefer `node:` import specifiers.

  3.2 Directory and Naming

- Keep existing structure; enforce naming with verbs + target: `deploy-web.sh`, `validate-exports.mjs`.
- Group by domain under subfolders (as today). New areas should add a subfolder with a `README.md` if complex.

  3.3 CLI Conventions

- Baseline flags for all scripts that mutate state:
  - `--dry-run` (no writes), `--yes` (skip prompts), `--verbose`, `--quiet`, `--json` (machine output), `--help`.
- Never prompt in CI; detect `CI=true` and imply `--yes` or exit with guidance.

  3.4 Logging and Exit Codes

- Use `scripts/utils/logger.mjs` from Node; add a thin Bash wrapper for consistent symbols/colors.
- Exit codes: 0 success; 1 generic failure; reserved codes for categories (e.g., 2 validation, 3 env/config, 4 network).

  3.5 Environment and Secrets

- Read inputs from flags first, env vars second, fallbacks last. Document precedence.
- Redact secrets in logs; never echo raw tokens. Centralize redaction helper.

  3.6 Idempotency and Safety

- All destructive operations must require `--yes`; print a clear preview on `--dry-run`.
- Validate preconditions up front (fail fast) and write atomically.

  3.7 Cross‑Platform Notes

- Keep Bash usage POSIX‑lean where possible; avoid GNU‑only flags unless required and documented.
- Prefer Node when complex parsing is needed.

  3.8 Documentation Requirements

- Header block in each script: purpose, inputs, flags, examples, exit codes.
- Each subfolder gets a short `README.md` if multiple scripts exist or if workflow is non‑trivial (e.g., `db/`, `secrets/`).

---

## 4) Quality Gates and Governance

- Validation: retain `validate-all.mjs` as the umbrella gate; keep `validate-imports.mjs`, `validate-exports.mjs`, `validate-code-quality.mjs` as building blocks.
- Pre‑commit (optional): `pre-commit-build-check.sh` can call a subset (fast checks) without heavy builds.
- PR Review Checklist: script changes must include header doc, `--dry-run` path for mutating actions, and examples.
- Change control: no new external dependencies without explicit approval; follow BUILDING.md constraints.

---

## 5) Immediate, Non‑Breaking Improvements (Backlog – do not execute yet)

S (quick wins)

- Standardize shebangs and `set -euo pipefail` across all Bash scripts (confirm present; fill gaps).
- Ensure all Node scripts use `.mjs` (ESM) consistently or document exceptions.
- Unify `logger` usage in Node; add small Bash logging shim for parity.
- Add `--dry-run` and `--yes` support to scripts that mutate state (deploy, db, secrets), default to safe mode in CI.

M

- Introduce a tiny CLI helper for Node (no new dependency): parse flags, support `--json`/`--verbose`/`--dry-run`.
- Add script headers where missing with Purpose/Usage/Examples/Exit Codes.
- Create `scripts/README.md` index linking to subfolder READMEs and core tasks.

L

- Establish JSON output mode for CI in validation/reporting scripts (keep human output default locally).
- Add smoke tests for critical scripts (dry‑run paths in CI).

---

## 6) Authoring Checklist (to include in PR template)

- Clear Purpose and header present
- Inputs documented (flags/env vars) and precedence defined
- Supports `--help`, `--dry-run`, `--yes`, and sensible default behavior
- Non‑interactive in CI; exits with meaningful codes
- Logs are concise, colored locally; machine‑readable option available if relevant
- Idempotent or safe to re‑run; atomic writes
- Uses `scripts/utils/logger` (Node) or Bash shim
- No new deps without approval; adheres to BUILDING.md constraints

---

## 7) Templates (for future use)

7.1 Bash Template

```bash
#!/usr/bin/env bash
set -euo pipefail

# Purpose: <one line>
# Usage: ./scripts/<name>.sh [--dry-run] [--yes] [--verbose]
# Exit codes: 0 success; 3 env/config error; 4 network error; 1 other

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN=false
ASSUME_YES=false
VERBOSE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|--no-confirm) ASSUME_YES=true ;;
    --verbose) VERBOSE=true ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--yes] [--verbose]"; exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# Example preconditions
command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found"; exit 3; }

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Would perform actions..."
  exit 0
fi

if [ "$ASSUME_YES" != true ] && [ -t 1 ] && [ -z "${CI:-}" ]; then
  read -r -p "Proceed? (y/N) " yn; [[ $yn == "y" ]] || exit 1
fi

# Do work...
```

7.2 Node ESM Template

```js
#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')

function parseFlags(argv) {
  const flags = {
    dryRun: false,
    yes: false,
    verbose: false,
    json: false,
    help: false,
  }
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') flags.dryRun = true
    else if (a === '--yes' || a === '--no-confirm') flags.yes = true
    else if (a === '--verbose') flags.verbose = true
    else if (a === '--json') flags.json = true
    else if (a === '-h' || a === '--help') flags.help = true
    else throw new Error(`Unknown flag: ${a}`)
  }
  return flags
}

async function main() {
  const flags = parseFlags(process.argv)
  if (flags.help) {
    console.log(
      'Usage: node script.mjs [--dry-run] [--yes] [--verbose] [--json]',
    )
    process.exit(0)
  }
  if (process.env.CI === 'true') {
    // Avoid prompts in CI
  }
  if (flags.dryRun) {
    console.log('[DRY-RUN] Would perform actions...')
    process.exit(0)
  }
  // Do work...
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
```

---

## 8) Execution Plan (Phased, Pending Approval)

Phase 1 – Baseline and Docs (S)

- Add/verify headers and `--help` across scripts; ensure `set -euo pipefail` and ESM `.mjs` where applicable.
- Introduce consistent `--dry-run`/`--yes` flags on mutating scripts.
- Create `scripts/README.md` that indexes common tasks and links to subfolders.

Phase 2 – UX and Safety (M)

- Adopt shared logger in Node and Bash shim; unify colored output and symbols.
- Add JSON output mode for validation/reporting scripts used in CI.
- Ensure CI sets `CI=true` and all scripts respect non‑interactive defaults.

Phase 3 – Guardrails and Tests (L)

- Add minimal smoke tests (dry‑run) for critical scripts (deploy, db, secrets rotation).
- Document deprecation policy and replacement flow for scripts.

Deliverables of this plan are documentation‑only at this stage. Implementation requires explicit approval and will be performed in small, verifiable increments.
