# Add `office_id` to CRM contacts (mailing list import)

## Context

The mailing list upload is the **My Clients → Import CSV** flow (`src/components/ImportClientsDialog.tsx`), which writes into the `clients` table. Today the importer accepts: First Name, Last Name, Email, Phone, and Client Type (buyer/seller/renter/**agent**/lender/attorney/inspector/other) — that's the "client type for agents" lever you used last time.

You want to add **`Office ID`** as another optional column so you can tag imported contacts (especially agents) with their office identifier. Since there's no `offices` table in the schema today, `office_id` will be a free-text string (e.g. an MLS office code) — no FK, no constraint.

## Plan

### 1. Database migration
New file `supabase/migrations/<timestamp>_add_office_id_to_clients.sql`:
- `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS office_id text;`
- `CREATE INDEX IF NOT EXISTS idx_clients_agent_office ON public.clients(agent_user_id, office_id);`

No RLS, grant, or trigger changes — column inherits existing policies on `clients`.

### 2. CSV importer (`src/components/ImportClientsDialog.tsx`)
- Add `office_id: z.string().trim().max(64).nullable().optional()` to `clientRowSchema`.
- Add `office_id?: string` to `ParsedClient`.
- In `parseCSV`, detect header `Office ID` (case-insensitive) with aliases: `office_id`, `office id`, `office`, `mls office id`, `mls office`. Pull the value into `office_id`.
- Pass `office_id` through `validateClients` and into the insert payload (`office_id: client.office_id || null`).
- Update the "CSV Format Requirements" help text to list `Office ID` under Optional columns (alongside Phone and Client Type).

### 3. Snapshot + docs (per project migration policy)
- Run `npm run db:snapshot` after the migration is applied so `docs/database/schema_snapshot.sql` reflects the new column. (You'll do this; I'll only write the migration file.)

## Out of scope
- No new `offices` table, no foreign key, no dropdown picker.
- No UI changes to the My Clients table, filters, or contact detail view (follow-up if you want office to be visible/filterable).
- No changes to other lists (`agent_early_access`, `coming_soon_signups`, `hot_sheet_subscribers`).
- No backfill of existing rows — column is nullable, existing data stays as-is.

## Header used
Primary header label: **`Office ID`** (matches your message). Aliases above keep imports forgiving.
