# AAC Production Schema Architecture Reference

**Generated:** 2026-04-03  
**Database:** 77 tables · 245 RLS policies · 73 functions · 63 triggers · 5 views · 4 enums

---

## What Was Wrong vs What Is Now Fixed

| Issue | Status |
|-------|--------|
| Duplicate trigger on `seller_match_outcomes` | ✅ Fixed — dropped redundant `set_seller_match_latest_outcome` trigger |
| 3 duplicate RLS policies on `agent_settings` | ✅ Fixed — dropped `settings_insert_own`, `settings_read_own`, `settings_update_own` |
| `listings.status` unconstrained text | ✅ Fixed — CHECK constraint `chk_listing_status` added |
| `listings.property_type` unconstrained text | ✅ Fixed — CHECK constraint `chk_listing_property_type` added, 1 row normalized |
| `email_jobs.status` unconstrained text | ✅ Fixed — CHECK constraint `chk_email_job_status` added |
| `hot_sheet_comments.sender_role` unconstrained text | ✅ Fixed — CHECK constraint `chk_hot_sheet_comment_sender_role` added |
| `conversation_participants` missing archive/mute | ✅ Fixed — `is_archived`, `is_muted` columns added |
| Missing composite index on `hot_sheet_comments` | ✅ Fixed — `idx_hot_sheet_comments_hs_listing` added |
| No schema documentation existed | ✅ Fixed — this document + ERD generated |

---

## Enums

| Enum | Values |
|------|--------|
| `app_role` | `admin`, `agent`, `buyer` |
| `agent_status` | `pending`, `verified`, `rejected`, `suspended` |
| `property_type` | `single_family`, `condo`, `townhouse`, `multi_family`, `land`, `commercial`, `residential_rental`, `commercial_rental` |
| `seller_match_outcome` | `interested`, `not_interested`, `follow_up`, `under_contract`, `closed` |

---

## Module 1: Auth / Roles / Profiles

### `profiles`
- **Purpose:** Core user identity for all authenticated users (agents, buyers, admins)
- **PK:** `id` (uuid, references `auth.users`)
- **Key columns:** `email`, `first_name`, `last_name`, `phone`, `company`, `avatar_url`, `deactivated_at`
- **Indexes:** PK
- **RLS:** Users CRUD own row; admins can manage all; anyone can read

### `user_roles`
- **Purpose:** Role assignments (admin/agent/buyer) — separate from profile for security
- **PK:** `id`
- **Key columns:** `user_id`, `role` (app_role enum)
- **Unique:** `(user_id, role)`
- **RLS:** Users read own; admins manage all
- **Trigger:** `auto_create_buyer_workspace` — creates workspace when buyer role assigned

### `agent_profiles`
- **Purpose:** Public agent profile (directory listing, headshot, bio, office info)
- **PK:** `id` (uuid = auth.users.id)
- **Key columns:** `email`, `first_name`, `last_name`, `aac_id` (auto-generated), `headshot_url`, `logo_url`, `office_name`, `office_city`, `office_state`, `bio`, `social_links` (jsonb), `header_background_type/value`
- **Unique:** `aac_id`
- **Indexes:** `(created_at DESC, id DESC)`, `(office_state, created_at DESC)`
- **RLS:** Anyone can view; agents insert/update own; admins can delete
- **Triggers:** `set_aac_id_on_insert`, `log_profile_change`

### `agent_settings`
- **Purpose:** Private agent account settings (onboarding state, verification, preferences)
- **PK:** `user_id`
- **Key columns:** `agent_status` (enum), `onboarding_completed`, `license_number`, `license_state`, `verified_at`, `price_min/max`, `property_types[]`, `state`, `county`, `towns[]`, `email_frequency`, `notifications_enabled`, `tour_completed`, `welcome_modal_dismissed`
- **Indexes:** `agent_status`, `onboarding_completed`
- **RLS:** Users CRUD own row; admins can manage all
- **Trigger:** `set_agent_settings_updated_at`

### `agent_early_access`
- **Purpose:** Pre-launch agent registration (founding partners)
- **PK:** `id`
- **Key columns:** `email`, `first_name`, `last_name`, `brokerage`, `state`, `license_number`, `founding_partner`, `status`
- **Unique:** `email` (case-insensitive)
- **RLS:** Anyone can insert; admins can read/update/delete

### `agent_invites`
- **Purpose:** Agent-to-agent invitation tracking
- **PK:** `id`
- **Key columns:** `inviter_user_id`, `invitee_email`, `status`, `accepted_at`, `accepted_user_id`
- **RLS:** Inviter can insert and read own

### `agent_license_uploads`
- **Purpose:** License document uploads for verification
- **PK:** `id`
- **Key columns:** `user_id`, `file_path`, `file_name`, `status`, `admin_notes`
- **RLS:** Agents insert/read own; admins can update

### `deleted_users`
- **Purpose:** Audit trail for deleted accounts
- **PK:** `id`
- **Key columns:** `original_user_id`, `email`, `deleted_by`, `deletion_reason`, `original_data` (jsonb)

### `pending_verifications`
- **Purpose:** Tracks in-progress license verification attempts

---

## Module 2: Messaging

### `conversations`
- **Purpose:** Conversation thread metadata (agent-to-agent)
- **PK:** `id`
- **Key columns:** `agent_a_id`, `agent_b_id`, `listing_id`, `buyer_need_id`, `last_message_at`
- **Indexes:** `(agent_a_id)`, `(agent_b_id)`, `(listing_id)`, `(buyer_need_id)`, `(last_message_at DESC)`
- **RLS:** Participants can view; system can insert
- **Trigger:** Updates `last_message_at` on new message

### `conversation_participants`
- **Purpose:** Maps users to conversations with read state
- **PK:** `(conversation_id, user_id)` composite
- **Key columns:** `last_read_at`, `is_archived` ✨NEW, `is_muted` ✨NEW
- **Indexes:** `(user_id, last_read_at DESC)`, `(conversation_id)`
- **RLS:** Users can read/update own participation rows

### `conversation_messages`
- **Purpose:** Individual messages within conversations (append-only)
- **Key columns:** `conversation_id`, `sender_agent_id`, `recipient_agent_id`, `subject`, `body`, `read_at`
- **Indexes:** `(conversation_id, created_at)`, `(sender_agent_id)`, `(recipient_agent_id)`
- **RLS:** Participants can read; sender can insert
- **Trigger:** `enqueue_message_email` — auto-enqueues email notification

### `agent_messages`
- **Purpose:** Public-facing messages sent to agents (from listing pages)
- **Key columns:** `listing_id`, `agent_id`, `sender_name`, `sender_email`, `message`
- **RLS:** Anyone can insert; agents view own

### `client_agent_messages`
- **Purpose:** Messages between CRM clients and agents
- **Key columns:** `agent_id`, `client_id`, `sender_user_id`, `subject`, `message`, `email_job_id`
- **RLS:** Agents view messages to them; buyers can insert and view own

---

## Module 3: Buyer Workspaces

### `buyer_workspaces`
- **Purpose:** Container for a buyer's workspace (auto-created on buyer role assignment)
- **PK:** `id`
- **Unique:** `owner_id` (one workspace per buyer)
- **RLS:** Members can view; owner can update

### `buyer_workspace_members`
- **Purpose:** Maps users to workspaces with roles
- **PK:** `id`
- **Unique:** `(workspace_id, user_id)`
- **Key columns:** `role` (default: 'member')
- **RLS:** Members can view; owner can insert/delete

### `buyer_workspace_invites`
- **Purpose:** Invitations to join a buyer workspace
- **PK:** `id`
- **Unique:** `token`, `(workspace_id, buyer_email)` where pending
- **Key columns:** `buyer_email`, `buyer_first_name`, `buyer_last_name`, `token`, `workspace_id`, `agent_id`, `expires_at`, `accepted_at`, `last_resent_at`
- **Indexes:** 7 specialized indexes for pending invite lookups
- **RLS:** Workspace owners can CRUD
- **Trigger:** `prevent_bwi_acceptance_overwrite` — immutable once accepted

### `buyer_credentials`
- **Purpose:** Financial credentials (pre-approval letters, proof of funds)
- **Key columns:** `user_id`, `credential_type`, `document_url`, `verification_status`, `approval_amount`, `lender_name`, `expires_at`
- **RLS:** Users CRUD own; agents can view verified+current credentials

### `buyer_qualifications`
- **Purpose:** Buyer qualification profile (one per user)
- **Unique:** `user_id`
- **Key columns:** `qualification_method`, `pre_approval_uploaded`, `proof_of_funds_uploaded`, `documentation_agreed`, `receive_agent_proposals`
- **RLS:** Admins can manage all

---

## Module 4: Client CRM

### `clients`
- **Purpose:** Agent's CRM contact records (independent of auth users)
- **PK:** `id`
- **Key columns:** `agent_id`, `agent_user_id`, `email`, `first_name`, `last_name`, `phone`, `client_type`, `source`, `is_favorite`, `notes`
- **Indexes:** `(agent_id)`, `(agent_id, email)`
- **RLS:** Agents CRUD own clients; admins can delete

### `client_agent_relationships`
- **Purpose:** Tracks active agent-buyer relationships (one active per buyer at a time)
- **Key columns:** `client_id`, `agent_id`, `crm_client_id`, `status`, `invitation_token`, `ended_at`
- **Indexes:** `(client_id, status, agent_id)`, `(agent_id, status)`
- **RLS:** Agents and clients can view own relationships
- **Trigger:** `check_single_active_agent` — enforces one active agent per client

### `client_needs`
- **Purpose:** Buyer search criteria submitted by agents
- **Key columns:** `submitted_by` (agent), `property_type` (enum), `max_price`, `city`, `state`, `county_id`, `bedrooms`, `bathrooms`
- **RLS:** All authenticated can view; verified agents can insert own

---

## Module 5: Listings

### `listings`
- **Purpose:** Core listing records (119 columns — full property data)
- **PK:** `id`
- **Key columns:** `agent_id`, `address`, `city`, `state`, `zip_code`, `price`, `bedrooms`, `bathrooms`, `square_feet`, `lot_size`, `property_type`, `status`, `listing_number` (auto-generated), `photos` (jsonb), `description`, `latitude/longitude`, `commission_rate/type`
- **CHECK constraints:** `chk_listing_status`, `chk_listing_property_type` ✨NEW
- **Indexes:** `(agent_id)`, `(status)`, `(city)`, `(state)`, `(property_type)`, `(price)`, `(listing_number)`, `(address_normalized)`, `(created_at DESC)`, and many more
- **RLS:** Anyone can view active/coming_soon; agents CRUD own; admins can manage all
- **Triggers:** `initialize_listing_stats`, `log_listing_status_change`, `log_listing_change`, `set_listing_active_date`, `set_cancelled_date`, `track_favorite_price_changes`, `normalize_listing_address`, `check_and_link_relisting`, `notify_matching_buyers_on_new_listing`

### `listing_stats`
- **Purpose:** Aggregated listing performance metrics
- **Unique:** `listing_id`
- **Key columns:** `view_count`, `save_count`, `share_count`, `contact_count`, `showing_request_count`, `cumulative_active_days`

### `listing_views` / `listing_shares`
- **Purpose:** Individual view/share event tracking
- **Triggers:** Auto-increment counters in `listing_stats`

### `listing_status_history` / `listing_price_history`
- **Purpose:** Audit trail for status and price changes
- **Automatically populated by triggers**

### `favorites`
- **Purpose:** User-saved listings
- **Key columns:** `user_id`, `listing_id`
- **Trigger:** Updates `listing_stats.save_count`

### `favorite_price_history`
- **Purpose:** Tracks price changes on saved listings for user notifications

### `showing_requests`
- **Purpose:** Showing/tour request management
- **Key columns:** `listing_id`, `requester_id`, `agent_id`, `status`, `preferred_date/time`, `message`

### `listing_drafts` ⚠️
- **Purpose:** Legacy — unused. Drafts now use `listings.status = 'draft'`

---

## Module 6: Hot Sheets

### `hot_sheets`
- **Purpose:** Curated listing feeds for buyer clients
- **PK:** `id`
- **Key columns:** `user_id` (agent owner), `client_id`, `name`, `criteria` (jsonb filter), `is_active`, `notification_schedule`, `access_token`
- **Indexes:** `(user_id)`, `(client_id)`, `(is_active)`
- **RLS:** Agent owner can CRUD; linked clients can view
- **Trigger:** `sync_hot_sheet_to_client_needs`

### `hot_sheet_clients`
- **Purpose:** Junction table linking hot sheets to CRM clients
- **Unique:** `(hot_sheet_id, client_id)`

### `hot_sheet_comments`
- **Purpose:** Threaded comments on listings within hot sheets
- **Key columns:** `hot_sheet_id`, `listing_id`, `sender_id`, `sender_role`, `comment`
- **CHECK:** `chk_hot_sheet_comment_sender_role` ✨NEW
- **Index:** `idx_hot_sheet_comments_hs_listing` ✨NEW
- **Trigger:** `on_hot_sheet_comment_inserted` — email notifications to agent/clients

### `hot_sheet_listing_status`
- **Purpose:** Per-listing status within a hot sheet (interested/passed/etc.)

### `hot_sheet_sent_listings`
- **Purpose:** Tracks which listings were sent to prevent re-sending

### `hot_sheet_favorites` / `hot_sheet_notifications` / `hot_sheet_shares` / `hot_sheet_subscribers`
- **Purpose:** Supporting tables for favorites, notifications, sharing, and email subscriptions

---

## Module 7: Seller Matching

### `agent_match_submissions`
- **Purpose:** Seller property submissions for agent matching
- **Key columns:** `seller_email`, `address`, `city`, `state`, `property_type`, `asking_price`, `bedrooms`, `bathrooms`, `square_feet`, `status`, `delivery_fee_cents`, `expires_at`

### `agent_match_deliveries`
- **Purpose:** Tracks which agents received a submission
- **Unique:** `(submission_id, agent_id, hot_sheet_id)`

### `seller_matches`
- **Purpose:** Materialized match records between submissions and agents
- **Key columns:** `submission_id`, `agent_id`, `hot_sheet_id`, `delivery_id`, `latest_outcome`, `latest_outcome_at`, `next_followup_at`

### `seller_match_outcomes`
- **Purpose:** Outcome history for each match (interested/not_interested/follow_up/etc.)
- **Trigger:** `trg_seller_match_outcomes_latest` → updates `seller_matches.latest_outcome`

---

## Module 8: Email System

### `email_jobs`
- **Purpose:** Async email queue (JSONB payload pattern)
- **Key columns:** `payload` (jsonb: provider, template, to, subject, variables), `status`, `attempts`, `max_attempts`, `last_error`, `run_after`, `idempotency_key`
- **CHECK:** `chk_email_job_status` ✨NEW
- **Indexes:** `(status, run_after)`, `(idempotency_key)`, `(created_at DESC)`
- **RLS:** Protected — server-side only (triggers can insert)

### `email_templates`
- **Purpose:** Agent-managed email templates
- **Key columns:** `agent_id`, `name`, `subject`, `body`, `category`, `is_default`

### `email_campaigns` / `email_sends` / `email_events` / `email_opens` / `email_clicks`
- **Purpose:** Campaign tracking and analytics pipeline

---

## Module 9: Sharing / Tokens

### `share_tokens`
- **Purpose:** Secure tokens for client hot sheet access, invites, etc.
- **Key columns:** `token`, `payload` (jsonb), `created_by`, `expires_at`, `accepted_by_user_id`, `accepted_at`

### `invite_events`
- **Purpose:** Audit trail for all invite lifecycle events
- **Key columns:** `token_id`, `event_type`, `actor_user_id`, `client_email`, `meta` (jsonb)

---

## Module 10: Ads / Vendor

### `vendor_profiles` / `vendor_subscriptions`
- **Purpose:** Vendor accounts and subscription management

### `advertisements` / `ad_packages` / `ad_impressions` / `ad_clicks`
- **Purpose:** Ad serving, packaging, and analytics

---

## Module 11: Teams

### `teams`
- **Purpose:** Agent team management
- **Key columns:** `name`, `created_by`

### `team_members`
- **Purpose:** Team membership with roles (owner/member)
- **Unique:** `(team_id, agent_id)`

---

## Module 12: Platform

### `feature_flags`
- **Purpose:** Runtime feature toggles
- **RPC:** `is_feature_enabled(flag_name)`

### `rate_limits`
- **Purpose:** Rate limiting infrastructure
- **RPC:** `rate_limits_cleanup()`

### `audit_logs`
- **Purpose:** System-wide audit trail
- **Key columns:** `user_id`, `action`, `table_name`, `record_id`, `ip_address`, `user_agent`

### `notification_preferences`
- **Purpose:** Per-user notification settings

### `agent_notifications`
- **Purpose:** In-app notification inbox for agents

### `saved_searches`
- **Purpose:** Saved listing search filters

### `counties` / `agent_county_preferences` / `agent_state_preferences` / `agent_buyer_coverage_areas`
- **Purpose:** Geographic preference and coverage area management

### `testimonials` / `coming_soon_signups`
- **Purpose:** Marketing/social proof content

---

## Views

| View | Purpose |
|------|---------|
| `agent_presence` | Safe read-only view of agent online status (from `agent_settings.last_seen_at`) |
| `agent_directory_status` | Agent status for directory filtering |
| `conversation_inbox` | Inbox-optimized view joining conversations + participants + last message |
| `seller_matches_public` | Public-safe view of seller match data |
| `clients_with_relationship_status` | Clients enriched with active relationship status |

---

## Key RPC Functions

| Function | Purpose |
|----------|---------|
| `resolve_user_role(uuid)` | Returns role + verification status for a user |
| `has_role(uuid, app_role)` | SECURITY DEFINER role check |
| `is_verified_agent()` | Check if current user is a verified agent |
| `activate_agent_relationship(uuid)` | Create/activate agent-buyer relationship |
| `agent_end_client_relationship(uuid)` | End active relationship |
| `create_buyer_hot_sheet(text, jsonb)` | Buyer-initiated hot sheet creation |
| `check_hot_sheet_matches(uuid)` | Find matching listings for a hot sheet |
| `get_listing_interest_signals(uuid, uuid[])` | Aggregate interest data for listings |
| `delete_draft_listing(uuid)` | Safe cascade delete of draft listings |
| `admin_delete_consumer(uuid)` | Full consumer account deletion |
| `admin_deactivate_buyer(uuid)` | Soft-deactivate buyer account |
| `listings_within_radius(lat, lng, miles)` | Geospatial listing search |
| `is_feature_enabled(text)` | Feature flag check |

---

## Security Architecture

- **Role system:** `user_roles` table + `has_role()` SECURITY DEFINER function
- **245 RLS policies** covering all tables
- **Admin access:** Via `has_role(auth.uid(), 'admin')` — never client-side
- **Agent verification:** Via `agent_settings.agent_status = 'verified'` + `is_verified_agent()` RPC
- **Buyer workspace isolation:** Via `is_buyer_workspace_member()` / `is_buyer_workspace_owner()` helpers
- **Email queue:** Protected from client reads (trigger-only inserts)
- **Single active agent:** Enforced by `check_single_active_agent` trigger

