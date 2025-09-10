---
title: 'ADR-0001: Architecture Decision Record Template'
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [adr, template, architecture]
---

# ADR-0001: Architecture Decision Record Template

## Status

**TEMPLATE** - Use this template for new ADRs

## Context

Architecture Decision Records (ADRs) capture important architectural decisions made during the project. This template ensures consistency and completeness.

## Decision

We will use this template for all architectural decisions that:

- Affect multiple components or packages
- Have long-term implications
- Involve trade-offs between alternatives
- Need to be communicated to the team
- May be questioned or revisited later

## Consequences

### Positive

- Consistent documentation of architectural decisions
- Clear rationale for future team members
- Easier to revisit and update decisions
- Improved team communication

### Negative

- Additional overhead for documenting decisions
- Need to maintain and update ADRs

## Template Structure

```markdown
---
title: 'ADR-XXXX: [Short Decision Title]'
owner: [team-name]
status: [proposed|accepted|deprecated|superseded]
last_reviewed: YYYY-MM-DD
tags: [relevant, tags]
---

# ADR-XXXX: [Short Decision Title]

## Status

**[PROPOSED|ACCEPTED|DEPRECATED|SUPERSEDED]** - [Optional status note]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing or have agreed to implement?

## Consequences

### Positive

What becomes easier or better after this change?

### Negative

What becomes more difficult or worse after this change?

## Alternatives Considered

What other options were evaluated? Why were they rejected?

## Implementation Notes

Any specific implementation details, migration steps, or timeline considerations.

## References

- Links to related issues, PRs, or documents
- External resources that influenced the decision
```

## Implementation Notes

1. **Numbering**: Use sequential numbering (ADR-0001, ADR-0002, etc.)
2. **File Naming**: `ADR-XXXX-short-title.md` in `docs/architecture/adr/`
3. **Status Values**:
   - `PROPOSED`: Under discussion
   - `ACCEPTED`: Approved and being implemented
   - `DEPRECATED`: No longer recommended
   - `SUPERSEDED`: Replaced by a newer ADR
4. **Review Process**: ADRs should be reviewed by the platform team before acceptance

## References

- [Architecture Decision Records](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
