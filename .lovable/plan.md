

# Update Schema Drift Protection for Lovable Cloud

## Problem
The current GitHub Actions workflow requires manual `PGHOST`/`PGUSER`/etc. secrets to connect to the database and run `pg_dump`. Since the database is managed by Lovable Cloud, those credentials aren't available to configure in GitHub.

## Solution
Split drift protection into two complementary checks:

1. **GitHub Actions (no DB needed)** — Verify that whenever migration files change, the snapshot file was also updated in the same PR. This is a pure file-level check requiring zero database credentials.

2. **Lovable sandbox (has DB access)** — The real `pg_dump` comparison continues to work via `npm run db:check` in the sandbox where PG env vars are already injected. This is where developers actually regenerate and verify the snapshot before committing.

## Changes

### 1. Rewrite `.github/workflows/schema-drift.yml`
Replace the `pg_dump`-based check with a file-level guard:
- Trigger on PRs that touch `supabase/migrations/**`
- Use `git diff` to check if `docs/database/schema_snapshot.sql` was also modified in the PR
- Fail with a clear message if migrations changed but snapshot wasn't updated
- No PostgreSQL client install needed, no secrets needed

### 2. Keep `scripts/check-schema-drift.sh` unchanged
This script still works perfectly inside the Lovable sandbox where `pg_dump` and PG env vars are available. Developers run `npm run db:check` before committing.

### 3. Keep `package.json` scripts unchanged
`db:snapshot` and `db:check` remain as-is — they work in the Lovable sandbox.

## Result
- GitHub Actions catches PRs that add migrations without updating the snapshot — no credentials needed
- `npm run db:check` in the Lovable sandbox does the real `pg_dump` comparison
- No manual secret management
- No database password exposure
- Full drift protection preserved

## Files modified
- `.github/workflows/schema-drift.yml` (rewrite)

No other files change.

