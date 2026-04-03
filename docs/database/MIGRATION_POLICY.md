# AAC Migration Policy

## Rules

1. **Never edit the database schema directly.** All structural changes must go through migration files.
2. **Always create a migration file** in `supabase/migrations/` for any schema change.
3. **Never modify existing migration files** — they represent historical state. Create a new migration instead.

## Naming Convention

```
YYYYMMDDHHMM_description.sql
```

Examples:
- `202604032130_add_conversation_archive_flags.sql`
- `202604040900_create_showing_requests_table.sql`
- `202604041500_add_index_on_listings_status.sql`

## Required Workflow

Every schema change must follow these steps in order:

1. **Write migration** — Use the template at `supabase/migrations/_template.sql`
2. **Run migration** — Execute via Lovable's migration tool
3. **Update snapshot** — Run `npm run db:snapshot`
4. **Verify** — Run `npm run db:check` to confirm snapshot matches live schema
5. **Commit together** — Migration file + updated `docs/database/schema_snapshot.sql` in the same commit

## Best Practices

- **Small additive changes preferred** — One concern per migration
- **Use IF NOT EXISTS / IF EXISTS** — Migrations must be idempotent where possible
- **Include rollback notes** — Document how to reverse the migration at the bottom of the file
- **Destructive changes require a rollback plan** — Dropping tables, columns, or constraints must be documented and approved
- **Add comments in SQL** — Explain the purpose and any non-obvious decisions
- **Update documentation** — If the change affects the architecture doc or ERD, update `docs/database/AAC_Schema_Architecture.md` and `docs/database/AAC_ERD.mmd`

## PR Requirements

Every pull request that includes schema changes **must** contain:

- [ ] Migration file in `supabase/migrations/`
- [ ] Updated `docs/database/schema_snapshot.sql`
- [ ] Passing `npm run db:check`
- [ ] Updated architecture docs (if applicable)

## CI Enforcement

The GitHub Actions workflow at `.github/workflows/schema-drift.yml` will automatically fail PRs that include migration changes without an updated snapshot.
