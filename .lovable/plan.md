

# Generate SQL Import Scripts for New Supabase Project

## Overview

Create ready-to-run SQL import scripts from the 78 exported CSVs. You'll paste these into your new Supabase SQL Editor after applying the schema migrations.

## Prerequisites (You Do First)

1. Apply all 203 migrations from `supabase/migrations/` to your new project (via `supabase db push` or pasting sequentially in SQL Editor)
2. Tables must exist before running import scripts

## What I'll Generate

### `/mnt/documents/aac_import/README.md`
Step-by-step instructions for running the import in your new Supabase SQL Editor.

### `/mnt/documents/aac_import/` — SQL files in dependency order

| File | Tables | Rows |
|------|--------|------|
| `01_profiles_roles.sql` | profiles, user_roles | 31 |
| `02_agent_core.sql` | agent_profiles, agent_settings, agent_early_access, agent_invites | 135 |
| `03_counties_flags.sql` | counties, feature_flags | 11 |
| `04_clients.sql` | clients, client_needs, client_agent_relationships | 202 |
| `05_listings.sql` | listings, listing_stats, listing_status_history, listing_price_history, listing_drafts, listing_shares, listing_views | 442 |
| `06_conversations.sql` | conversations, conversation_participants, conversation_messages | 48 |
| `07_hot_sheets.sql` | hot_sheets, hot_sheet_clients, hot_sheet_sent_listings | 9 |
| `08_buyer_workspaces.sql` | buyer_workspaces, buyer_workspace_members, buyer_workspace_invites | 3 |
| `09_email.sql` | email_templates, email_jobs, email_events | 237 |
| `10_independent.sql` | share_tokens, invite_events, favorites, notification_preferences, ad_packages, testimonials, deleted_users, agent_messages, agent_notifications, agent_buyer_coverage_areas, agent_match_submissions, agent_proposal_incentives | 570 |
| `11_large_tables.sql` | public_records_cache, rate_limits, audit_logs | 1,794 |

### Approach

- Read each CSV, convert to `INSERT INTO ... VALUES (...)` with proper escaping
- Handle NULLs, timestamps, UUIDs, JSON, arrays, and quoted text
- All inserts use `ON CONFLICT DO NOTHING` for safe re-runs
- Large tables chunked into batches of 500 rows
- Dependency order prevents FK violations

## Technical Details

- Python script reads CSVs from `/mnt/documents/aac_export/`
- Outputs 11 numbered SQL files + README to `/mnt/documents/aac_import/`
- Empty tables (40) are skipped entirely
- Special handling for PostgreSQL array columns (`{}` syntax) and JSONB columns

## Deliverables

- 11 SQL files ready to paste into Supabase SQL Editor in order
- `README.md` with step-by-step instructions
- All files downloadable from `/mnt/documents/aac_import/`

## What This Does NOT Cover

- **Schema** — apply the 203 migrations first
- **Auth users** — must re-register or use Supabase Admin API
- **Storage files** — download from Lovable Cloud, upload to new buckets
- **Edge functions** — deploy via `supabase functions deploy`
- **Secrets** — configure per `secrets_checklist.txt`

