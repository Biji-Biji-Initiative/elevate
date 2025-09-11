# Schools Autocomplete — Onboarding Integration

This document explains how the Educator school selector works, how to load data, and how to test it.

## Overview

- Data lives in a dedicated `schools` table (name, city, province) with case‑insensitive uniqueness and a trigram index for fast search.
- API: `GET /api/schools?q=<query>&limit=<n>` returns up to 50 suggestions.
- Onboarding page (`/{locale}/onboarding/user-type`) uses a debounced autocomplete for Educators; selecting a suggestion fills the School field and (if empty) the Region/Province field.

## Schema & Migrations

- Migration file: `supabase/migrations/20250910193000_create_schools.sql`
  - `schools(id uuid pk, name citext unique not null, city text, province text, created_at timestamptz default now())`
  - GIN trigram index on `name` for fast `ILIKE` search
- Ensure required extensions exist: `citext`, `pg_trgm` (migration covers `citext`; import script enables `pg_trgm` on demand)

## Importing Data

Use the provided shell script to import from a CSV (Kaggle dataset example: `LIST UNIVERSITAS.csv`).

```
# From repo root
chmod +x scripts/db/import-schools.sh
./scripts/db/import-schools.sh "elevate/LIST UNIVERSITAS.csv"
```

- The script:
  - Creates a staging table `schools_import`
  - `\copy` loads the CSV with headers
  - Upserts into `schools` (distinct by `name`)
  - Cleans up staging
- It respects `DATABASE_URL` if set; otherwise uses `psql` defaults (PGHOST/PGPORT/PGUSER/PGDATABASE).

## API

- Route: `apps/web/app/api/schools/route.ts`
- Request: `GET /api/schools?q=<query>&limit=<n>`
- Response:
```
200 OK
{
  "data": [
    { "name": "Universitas ...", "city": "...", "province": "..." },
    ...
  ]
}
```

## UI (Onboarding)

- Educators must provide School and Region. School field shows suggestions after 2 characters; clicking a suggestion fills School and sets Region if Region was empty.
- Students only choose a role; no School or Region required.

## Testing

- After applying the migration and importing the CSV:
  - Hit `GET /api/schools?q=universitas&limit=5` and expect results.
  - In onboarding, type a prefix; suggestions appear and can be selected.

## Notes

- Data is de‑duplicated by `name` (case‑insensitive). Re‑imports safely update city/province for existing names.
- For larger datasets or different sources, reuse the import script; it handles staging + upsert safely.

