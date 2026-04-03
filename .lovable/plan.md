

# AAC Schema Cleanup + Documentation Package

## Part 1 — Safe Additive SQL Migrations

All migrations are non-destructive. No tables dropped, no functions replaced, no data lost.

### Migration 1: Critical — Remove Duplicates

**Duplicate trigger on `seller_match_outcomes`**
Two triggers (`set_seller_match_latest_outcome` and `trg_seller_match_outcomes_latest`) both call the same function. Drop the older/redundant one.

**Duplicate RLS policies on `agent_settings`**
Three duplicate policies exist alongside the originals:
- `settings_insert_own` duplicates `Users can insert own settings`
- `settings_read_own` duplicates `Users can read own settings`
- `settings_update_own` duplicates `Users can update own settings`

Drop the three `settings_*` duplicates.

### Migration 2: High Value — CHECK Constraints

Before adding constraints, fix one non-conforming row: `listings` has one row with `property_type = 'Single Family'` (capital case) — normalize it to `single_family` first.

Add these CHECK constraints:
- **`listings.status`**: `CHECK (status IN ('draft','coming_soon','active','pending','under_contract','sold','cancelled','withdrawn','temporarily_withdrawn','off_market','expired','back_on_market'))`
- **`listings.property_type`**: `CHECK (property_type IN ('single_family','condo','townhouse','multi_family','land','commercial','residential_rental','commercial_rental','apartment'))` — includes `apartment` which exists in live data but not in the enum
- **`email_jobs.status`**: `CHECK (status IN ('queued','processing','sent','failed','cancelled'))`
- **`hot_sheet_comments.sender_role`**: `CHECK (sender_role IN ('agent','client'))`

### Migration 3: High Value — New Columns + Indexes

**New columns on `conversation_participants`**:
- `is_archived boolean NOT NULL DEFAULT false`
- `is_muted boolean NOT NULL DEFAULT false`

**New index**:
- `idx_hot_sheet_comments_hs_listing ON hot_sheet_comments(hot_sheet_id, listing_id)`

Note: `client_agent_relationships(client_id, status)` already has a composite index (`car_client_status_agent_idx` on `client_id, status, agent_id`) — no new index needed.

### Migration 4: Update types.ts integration

After migrations run, the generated Supabase types will automatically update to include `is_archived` and `is_muted` on `conversation_participants`.

---

## Part 2 — Schema Architecture Document

Generate `/mnt/documents/AAC_Schema_Architecture.md` covering all 77 tables grouped into these modules:

| Module | Tables |
|--------|--------|
| **Auth / Roles / Profiles** | profiles, user_roles, agent_profiles, agent_settings, agent_early_access, agent_invites, agent_license_uploads, pending_verifications, deleted_users |
| **Messaging** | conversations, conversation_participants, conversation_messages, agent_messages, client_agent_messages |
| **Buyer Workspaces** | buyer_workspaces, buyer_workspace_members, buyer_workspace_invites, buyer_credentials, buyer_qualifications |
| **Client CRM** | clients, client_agent_relationships, client_needs |
| **Listings** | listings, listing_drafts, listing_stats, listing_views, listing_shares, listing_status_history, listing_price_history, favorites, favorite_price_history, showing_requests, off_market_views, public_records_cache |
| **Hot Sheets** | hot_sheets, hot_sheet_clients, hot_sheet_comments, hot_sheet_favorites, hot_sheet_listing_status, hot_sheet_notifications, hot_sheet_sent_listings, hot_sheet_shares, hot_sheet_subscribers |
| **Seller Matching** | agent_match_submissions, agent_match_deliveries, seller_matches, seller_match_outcomes |
| **Email System** | email_jobs, email_templates, email_campaigns, email_sends, email_events, email_opens, email_clicks |
| **Sharing / Tokens** | share_tokens, invite_events |
| **Ads / Vendor** | advertisements, ad_packages, ad_impressions, ad_clicks, vendor_profiles, vendor_subscriptions |
| **Teams** | teams, team_members |
| **Platform** | feature_flags, rate_limits, audit_logs, notification_preferences, agent_notifications, saved_searches, testimonials, coming_soon_signups, counties, agent_county_preferences, agent_state_preferences, agent_buyer_coverage_areas |

Each table entry will include: purpose, key columns, FKs, constraints, indexes, RLS summary.

Also documents: 5 views, 4 enums, key RPC functions.

---

## Part 3 — Visual ERD / Relationship Map

Generate a Mermaid ERD diagram (`/mnt/documents/AAC_ERD.mmd`) covering the six core modules with their primary relationships:
- Auth → Profiles → Agent Profiles → Agent Settings
- Conversations → Participants → Messages
- Buyer Workspaces → Members → Invites
- Listings → Stats, History, Favorites, Showings
- Hot Sheets → Clients, Comments, Sent Listings, Favorites
- Email Jobs queue

---

## Part 4 — "What Was Wrong vs What Is Now Fixed"

A short summary section included in the documentation:

| Issue | Status |
|-------|--------|
| Duplicate trigger on `seller_match_outcomes` | Fixed — dropped redundant trigger |
| 3 duplicate RLS policies on `agent_settings` | Fixed — dropped duplicates |
| `listings.status` unconstrained text | Fixed — CHECK constraint added |
| `listings.property_type` unconstrained text | Fixed — CHECK constraint added, 1 row normalized |
| `email_jobs.status` unconstrained text | Fixed — CHECK constraint added |
| `hot_sheet_comments.sender_role` unconstrained text | Fixed — CHECK constraint added |
| `conversation_participants` missing archive/mute | Fixed — columns added |
| Missing composite index on hot_sheet_comments | Fixed — index added |
| No schema documentation existed | Fixed — architecture doc + ERD generated |

---

## Execution Order

1. Run critical migration (drop duplicates)
2. Run data fix (normalize 1 property_type row)
3. Run CHECK constraints migration
4. Run columns + indexes migration
5. Generate architecture doc to `/mnt/documents/`
6. Generate ERD to `/mnt/documents/`

## Files Affected
- **Database**: 3 migrations (via migration tool)
- **Generated docs**: `/mnt/documents/AAC_Schema_Architecture.md`, `/mnt/documents/AAC_ERD.mmd`
- **No application code changes** — the new columns are additive with defaults, existing queries unaffected

