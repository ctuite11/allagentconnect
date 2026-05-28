# Stop Duplicate Client Imports

## Problem

The CSV importer (`ImportClientsDialog.tsx`) checks for duplicates against existing rows in `clients` by exact `email` match, but it has three gaps that let duplicates through:

1. **In-file duplicates** — if the same email appears twice in the CSV, both pass dedupe and both get inserted.
2. **Case/whitespace mismatch** — existing-email check is case-sensitive. `Jane@x.com` in DB and `jane@x.com` in CSV are treated as different.
3. **No DB-level guard** — there is no unique constraint on `(agent_id, lower(email))`, so a re-upload during the race window (or a second tab) can still create a duplicate.

## Plan

### 1. Frontend dedupe hardening (`src/components/ImportClientsDialog.tsx`)
- Normalize every parsed email to `trim().toLowerCase()` before validation, dedupe, and insert.
- Deduplicate within the parsed file: keep the first occurrence of each email, count the rest as "duplicates in file".
- Lowercase the existing-emails Set comparison so DB matches are case-insensitive.
- Update the final toast to surface both kinds of skips: in-file duplicates and existing-in-DB duplicates (AAC-registered count stays as-is).

### 2. Database guard (new migration)
- Add a partial unique index: `CREATE UNIQUE INDEX clients_agent_email_unique ON public.clients (agent_id, lower(email)) WHERE email IS NOT NULL;`
- Wrap each insert batch in a try/catch so a `23505` unique-violation from a race falls back to per-row insert that skips the conflicting rows (using `.upsert(..., { onConflict: 'agent_id,email', ignoreDuplicates: true })` is not viable because the index is on `lower(email)`, so we'll do a per-row insert-on-error retry and count failures as skipped duplicates).

### Out of scope
- No phone-based dedupe, no fuzzy name matching, no merging of existing rows, no changes to the AAC-registration check, no UI redesign of the dialog.

## Technical notes

- The existing `email` column is preserved as-typed; only comparisons are lowercased. We do not mutate stored email casing for historical rows.
- The partial unique index will fail to create if the `clients` table already contains case-insensitive duplicates for the same agent. The migration will first run a `SELECT` (via the migration's own SQL) that surfaces conflicts; if any exist, the migration aborts with a clear error so we can clean them up before retrying. No automatic deletion of existing rows.
