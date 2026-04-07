

# Export Full AAC Database for Migration

## What You Already Have (In Your Git Repo)

| Asset | Location | Status |
|-------|----------|--------|
| Schema (77 tables, indexes, constraints, FKs, views, functions, triggers) | `supabase/migrations/` (203 files) | ✅ Complete |
| RLS policies (245) | Included in migrations | ✅ Complete |
| Edge functions (58) | `supabase/functions/` | ✅ Complete |
| Config | `supabase/config.toml` | ✅ Complete |

## What This Export Will Produce

All **table data** exported as CSV files to `/mnt/documents/` — one file per table.

## Execution Plan

### Step 1 — Export all table data as CSVs

Run `psql` queries against every populated table and write CSVs to `/mnt/documents/aac_export/`. Tables include:

- `profiles`, `user_roles`, `agent_profiles`, `agent_settings`
- `listings`, `listing_stats`, `listing_status_history`, `listing_price_history`
- `clients`, `client_agent_relationships`, `client_needs`
- `conversations`, `conversation_participants`, `conversation_messages`
- `hot_sheets`, `hot_sheet_clients`, `hot_sheet_comments`, `hot_sheet_listing_status`, `hot_sheet_sent_listings`
- `favorites`, `favorite_price_history`
- `buyer_workspaces`, `buyer_workspace_members`, `buyer_workspace_invites`, `buyer_credentials`, `buyer_qualifications`
- `email_jobs`, `email_templates`, `email_campaigns`, `email_sends`
- `agent_early_access`, `agent_invites`, `agent_license_uploads`
- `share_tokens`, `invite_events`
- `teams`, `team_members`
- `feature_flags`, `audit_logs`, `counties`, `saved_searches`
- `seller_matches`, `seller_match_outcomes`, `agent_match_submissions`, `agent_match_deliveries`
- All remaining tables

### Step 2 — Generate row counts summary

Produce a manifest showing which tables have data and how many rows, so you know what matters.

### Step 3 — Document secrets needed

Output a checklist of all server-side secrets your edge functions reference (from scanning the function code).

## What This Does NOT Export (Manual Steps)

| Item | Why | What To Do |
|------|-----|------------|
| **Auth users** (`auth.users`) | Protected schema, no client access | Export via Lovable Cloud → Users panel, or re-register users |
| **Storage files** | Binary assets in buckets | Download from Cloud → Storage, re-upload to new project |
| **Auth Hook config** | Dashboard-level setting | Manually configure in new Supabase dashboard: Auth → Hooks → Send Email Hook |

## Deliverables

- `/mnt/documents/aac_export/` — all table CSVs
- `/mnt/documents/aac_export/manifest.txt` — row counts per table
- `/mnt/documents/aac_export/secrets_checklist.txt` — required secrets list

