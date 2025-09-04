# Spec Drift Guard — CI Plan

Checks

- Grep for Starter rule in `docs/leaps/badges.md` and `docs/leaps/kajabi-learn.md` → must both say strict-by-tag
- Verify AMPLIFY payload fields present in `packages/types/src/submission-payloads.api.ts`
- Verify /api/stats includes EDUCATOR filter and definitions
- Ensure errors-and-openapi examples exist in spec.ts

Failure → block PR with message linking to agent-tracker items.

