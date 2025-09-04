# CI Checklist & PR Template

CI must verify:

- Agent tracker items checked PASS in PR description
- OpenAPI examples present for documented errors
- Spec drift guard: Starter rule, AMPLIFY payload fields, counters definitions
- Vitest suites run: idempotency/race/caps/counters parity

PR Template (append to .github/pull_request_template.md)

```
## LEAPS Conformance
- [ ] Starter rule consistent (strict-by-tag)
- [ ] AMPLIFY payload includes session fields; caps enforced
- [ ] Stats follow Option B; exclude STUDENT
- [ ] Errors use envelope with examples updated
- [ ] Tests added/updated for this change

Link checks:
- Agent tracker sections updated: [ ] 1 [ ] 2 [ ] 3 [ ] 4 [ ] 5 [ ] 6 [ ] 7 [ ] 8 [ ] 9
```

