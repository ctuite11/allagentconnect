

# Add Versioned Migration Policy

## Changes

### 1. Create migration template
**File**: `supabase/migrations/_template.sql`
- Header comment block with purpose, author, date placeholders
- Safe additive structure (CREATE IF NOT EXISTS pattern)
- Rollback notes section at bottom

### 2. Create migration policy doc
**File**: `docs/database/MIGRATION_POLICY.md`
- Rules: never edit schema directly, always use migration files
- Naming convention: `YYYYMMDDHHMM_description.sql`
- Required steps: write migration → run it → `npm run db:snapshot` → `npm run db:check` → commit migration + snapshot together
- Small additive changes preferred
- Destructive changes require rollback plan

### 3. Update README
**File**: `README.md`
- Add "Schema Changes" section noting that PRs with DB changes must include: migration file, updated snapshot, passing `db:check`

### Files created/modified
- `supabase/migrations/_template.sql` (new)
- `docs/database/MIGRATION_POLICY.md` (new)
- `README.md` (add section)

No database changes. No application code changes.

