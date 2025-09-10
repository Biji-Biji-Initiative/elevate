# Submission Payloads — API ⇄ Database

This document explains how form submissions in the Web app map to API payloads (camelCase) and how they are transformed to database payloads (snake_case). It also lists required and optional fields per activity.

See source of truth in:

- packages/types/src/submission-payloads.api.ts (API schemas + transforms)
- packages/types/src/dto-mappers.ts (DB transforms for admin-facing reads)
- packages/types/src/submission-payloads.ts (discriminated union schema)

## Conventions

- Web forms produce API-shaped payloads in camelCase.
- API layer sanitizes and transforms to DB-shaped payloads in snake_case.
- Admin/API routes never assume raw request shape — they validate via shared schemas.

## Activities

- Learn (LEARN)
  - API: { provider, courseName, completedAt, certificateUrl?, certificateHash? }
  - DB: { provider, course_name, completed_at, certificate_url?, certificate_hash? }

- Explore (EXPLORE)
  - API: { reflection, classDate, school?, evidenceFiles?[] }
  - DB: { reflection, class_date, school?, evidence_files?[] }

- Amplify (AMPLIFY)
  - API: {
    peersTrained, studentsTrained, attendanceProofFiles?[],
    sessionDate,
    sessionStartTime?, durationMinutes?,
    location?: { venue?, city?, country? },
    sessionTitle?, coFacilitators?[], evidenceNote?
  }
  - DB: {
    peers_trained, students_trained, attendance_proof_files?[],
    session_date,
    session_start_time?, duration_minutes?,
    location?: { venue?, city?, country? },
    session_title?, co_facilitators?[], evidence_note?
  }

- Present (PRESENT)
  - API: { linkedinUrl, screenshotUrl?, caption }
  - DB: { linkedin_url, screenshot_url?, caption }

- Shine (SHINE)
  - API: { ideaTitle, ideaSummary, attachments?[] }
  - DB: { idea_title, idea_summary, attachments?[] }

## Example (Explore)

- API request body (payload only):

  {
    "activityCode": "EXPLORE",
    "payload": {
      "reflection": "We used AI to brainstorm lesson ideas...",
      "classDate": "2025-09-01",
      "school": "SMA Negeri 1 Jakarta",
      "evidenceFiles": ["/uploads/explore/lesson-plan.pdf"]
    },
    "attachments": ["/uploads/explore/lesson-plan.pdf"],
    "visibility": "PRIVATE"
  }

- DB payload after transform:

  {
    "activity_code": "EXPLORE",
    "payload": {
      "reflection": "We used AI to brainstorm lesson ideas...",
      "class_date": "2025-09-01",
      "school": "SMA Negeri 1 Jakarta",
      "evidence_files": ["/uploads/explore/lesson-plan.pdf"]
    }
  }

## Implementation Notes

- The Web app forms use Zod schemas in packages/types to validate inputs before submit.
- API routes sanitize and validate again via SubmissionCreateRequestSchema and transformers.
- Admin reads use DTO mappers to project DB payloads back to API/UI shapes.

## References

- packages/types/src/submission-payloads.api.ts
- packages/types/src/submission-payloads.ts
- packages/types/src/dto-mappers.ts
- apps/web/app/api/submissions/route.ts
- apps/web/app/[locale]/dashboard/*/page.tsx

