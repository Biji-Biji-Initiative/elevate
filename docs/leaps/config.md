# Configuration — Tunables and Modes

Org timezone

- `org.timezone` (IANA string, e.g., Asia/Kuala_Lumpur). All AMPLIFY caps, session parsing, duplicate checks use this.

Caps

- `amplifyCaps.peersPer7d`, `amplifyCaps.studentsPer7d`

Learn Starter rule

- `learnStarter.mode = 'strict_tags' | 'source_points'` (default: strict_tags)

Duplicate detection

- `duplicateWindowMinutes` (default: 45)

Evidence

- `evidence.signedUrlTtlSeconds` (default: 3600)

MCE provider

- `mce.provider = 'none' | 'import' | 'badge' | 'external_feed'` (default: none)


