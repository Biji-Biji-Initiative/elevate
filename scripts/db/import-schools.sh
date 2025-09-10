#!/usr/bin/env bash
set -euo pipefail

# Import schools from a CSV file into the `schools` table via a staging table.
# Works with a local or remote Postgres. Requires psql on PATH.
#
# Usage:
#   ./scripts/db/import-schools.sh "elevate/LIST UNIVERSITAS.csv"
#
# Env:
#   DATABASE_URL (preferred) or PSQL connection flags PGHOST/PGPORT/PGUSER/PGDATABASE

CSV_PATH=${1:-}
if [[ -z "$CSV_PATH" ]]; then
  echo "Usage: $0 <path-to-csv>" >&2
  exit 2
fi
if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 2
fi

PSQL_CMD=(psql)
if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL_CMD+=("$DATABASE_URL")
fi

echo "Creating staging table schools_import..."
"${PSQL_CMD[@]}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS schools_import;
CREATE TABLE schools_import (
  no text,
  nama text,
  npsn text,
  nama_singkat text,
  kode_pos text,
  telepon text,
  fax text,
  email text,
  alamat text,
  kota text,
  provinsi text,
  negara text,
  lintang text,
  bujur text,
  akreditasi text,
  status text,
  rank_qs text,
  rank_country text
);
SQL

echo "Copying CSV into staging..."
# Use \copy (client-side) to import respecting CSV headers
"${PSQL_CMD[@]}" -c "\\copy schools_import FROM '$CSV_PATH' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"

echo "Upserting into schools (distinct by name)..."
"${PSQL_CMD[@]}" <<'SQL'
INSERT INTO schools (name, city, province)
SELECT DISTINCT TRIM(nama), NULLIF(TRIM(kota), ''), NULLIF(TRIM(provinsi), '')
FROM schools_import si
WHERE nama IS NOT NULL AND TRIM(nama) <> ''
ON CONFLICT (name) DO UPDATE SET
  city = COALESCE(EXCLUDED.city, schools.city),
  province = COALESCE(EXCLUDED.province, schools.province);

DROP TABLE schools_import;
SQL

echo "Done. You can query with: SELECT * FROM schools LIMIT 20;"

