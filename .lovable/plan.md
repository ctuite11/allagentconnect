# Migrate AAC data and backend from Lovable Cloud

## Goal
Move the All Agent Connect database, auth users, storage files, and backend functions from Lovable Cloud to a standalone Supabase project that you control.

## High-level steps

### 1. Provision the destination
- Create a new Supabase project.
- Keep the project URL, anon key, and service role key for later steps.

### 2. Deploy the schema
- Run the 203 migration files in `supabase/migrations/` in order on the new project (via Supabase CLI `supabase db push` or the SQL Editor).
- Verify that all 78 tables, enums, functions, triggers, RLS policies, and grants match the current project.

### 3. Import table data
- Use the 11 dependency-ordered SQL import scripts (01_profiles_roles.sql through 11_large_tables.sql).
- These scripts reference 78 CSV data files. Import order matters because of foreign keys.
- Note: `05_listings.sql` includes a fix that replaces malformed PostgreSQL array/JSON literals in the `photos` column with `NULL` to avoid import syntax errors.

### 4. Migrate Auth users
- Export Auth users from the current project dashboard.
- Import them into the new Supabase project through its dashboard or a user-import script.
- Confirm that user IDs line up with `profiles` and `user_roles` rows.

### 5. Migrate Storage assets
- Copy files from the `listing-photos`, `headshots`, and any other custom buckets.
- Re-create bucket permissions and public URLs in the new project.

### 6. Configure the Auth email hook
- In the new project dashboard, attach the `send-auth-email` Auth Hook so sign-up, magic-link, and password-reset emails use the same AAC branded template and sender.

### 7. Deploy Edge Functions
- Deploy the 58 functions in `supabase/functions/` using the Supabase CLI (`supabase functions deploy`).
- Update any function secrets (API keys, service role key, Resend key, etc.) in the new project.

### 8. Point the frontend at the new backend
- Update `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_PUBLISHABLE_KEY` to the new project values.
- Rebuild and publish the app.

### 9. Verify
- Smoke-test sign-in, listing creation, media uploads, Hot Sheets, email sends, and admin workflows.
- Keep the old project read-only until verification is complete.

## Approach preference
Use the existing "Control First" approach: execute the SQL import scripts manually in the new project's SQL Editor rather than granting automated write access. This keeps you in control of each step and makes errors easy to inspect.

## What stays manual
- Auth user export/import through the dashboard.
- Storage file copy (no automated script is currently prepared).
- Auth Hook configuration in the new project dashboard.
- Edge function secrets and environment variables.

## Not in scope unless requested
- Frontend hosting migration (Netlify, Vercel, Lovable hosting decisions).
- DNS/custom domain changes.
- Code or schema changes beyond what is required for the migration.
