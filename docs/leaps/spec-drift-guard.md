# Spec Drift Guard — CI Plan

Checks

- If `learnStarter.mode` is `strict_by_tag`: verify docs state strict-by-tag.
- If `learnStarter.mode` is `source_points`: allow rollback phrasing if PR body contains an incident link and rollback plan banner.
- Verify AMPLIFY payload fields present in `packages/types/src/submission-payloads.api.ts`.
- Verify /api/stats includes EDUCATOR filter and definitions.
- Ensure errors-and-openapi examples exist in spec.ts.

Failure → block PR with message linking to agent-tracker items.
