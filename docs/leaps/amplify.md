# AMPLIFY — Evidence, Caps, and Scoring

Definitions

- peers (educators): teachers/staff trained by the educator.
- students: learners trained or reached via sessions.

Submission payload (API)

- `peersTrained: number` (0–50 UI bound)
- `studentsTrained: number` (0–200 UI bound)
- `attendanceProofFiles: string[]`
- `sessionDate: string (YYYY-MM-DD, org TZ)`
- `sessionStartTime?: string (HH:mm, org TZ)`
- `durationMinutes?: number`
- `location?: { venue?: string; city?: string; country?: string }`
- `sessionTitle?: string`
- `coFacilitators?: string[]`
- `evidenceNote?: string`

Evidence

- CSV/JPG/PDF accepted (allow‑list). Files are evidence only; we do not parse CSV.

Scoring

- Points = peersTrained × 2 + studentsTrained × 1.

Server validation

- Per‑submission bounds: peers ∈ [0,50], students ∈ [0,200].
- Rolling 7‑day cap by sessionDate in org TZ (config):
  - windowStart = startOfDay(sessionDate, orgTZ) − 6 days
  - windowEnd = endOfDay(sessionDate, orgTZ)
  - Enforce: (Σ peersApproved in window + peers) ≤ cap.peersPer7d, likewise for students.
- Use a per‑user advisory transaction lock during approval to avoid race: `pg_advisory_xact_lock(hashtext('AMPLIFY:'||user_id))`; recheck caps under lock.
- Late backfills (>30 days old by sessionDate) require admin override.

Duplicate‑session soft flag

- If an APPROVED session exists for the same user within ±45 minutes of `sessionStartTime` in the same `location.city`, flag as `DUPLICATE_SESSION_SUSPECT`; if `city` is null, skip this check and warn.

Suspicion score (heuristic; reviewer aid)

- +2 if peers+students > 180
- +3 if duplicate‑session suspect
- +2 if >3 sessions/day for 3 consecutive days
- +2 if no evidence files
- Flag review if score ≥ 4

Counters

- `peers_students_reached` = sum(peersTrained + studentsTrained) from APPROVED AMPLIFY submissions.

Org timezone

- Define `org.timezone` (IANA) in config; all cap windows, session parsing, and duplicate checks use org TZ.

Reviewer guidance

- Verify counts vs evidence sample; request re‑upload if unclear; note anomalies.
