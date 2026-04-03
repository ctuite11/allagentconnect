

# Schema Drift Protection

## Context
- `pg_dump` is available in the sandbox
- No Supabase CLI (not needed — `pg_dump` works directly)
- No `.github/workflows/` directory exists yet
- Existing docs at `docs/database/`

## Plan

### 1. Generate schema snapshot
Run `pg_dump --schema-only --schema=public` to capture the full structural snapshot (tables, columns, indexes, constraints, enums, views, functions, RLS policies) and save to `docs/database/schema_snapshot.sql`.

### 2. Create drift check script
Create `scripts/check-schema-drift.sh` that:
- Dumps current schema to a temp file
- Diffs against committed `docs/database/schema_snapshot.sql`
- Exits non-zero if differences found
- Prints a clear message showing what drifted

### 3. Add package.json scripts
```json
"db:snapshot": "pg_dump --schema-only --schema=public > docs/database/schema_snapshot.sql",
"db:check": "bash scripts/check-schema-drift.sh"
```

Note: These use `pg_dump` directly since the Supabase CLI isn't available in this environment. The commands work against the connected database using the preconfigured `pg` env vars.

### 4. Create GitHub Actions workflow
Create `.github/workflows/schema-drift.yml` that:
- Triggers on PRs
- Runs `npm run db:check`
- Fails the PR if schema has drifted without an updated snapshot

### Files created/modified
- `docs/database/schema_snapshot.sql` (generated)
- `scripts/check-schema-drift.sh` (new)
- `.github/workflows/schema-drift.yml` (new)
- `package.json` (add 2 scripts)

### Important caveat
The CI workflow needs database access to run `pg_dump`. In GitHub Actions, this requires the database connection string as a repository secret. The workflow will include a note about this setup requirement.

