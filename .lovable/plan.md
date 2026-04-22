

## Goal
Hard-delete `chris.tuite@compass.com` from the system so you can re-test the buyer add + email flow from scratch.

## Scope
This is a one-off data wipe via migration (DELETE statements require migration per project policy — `psql` insert/select access can't DELETE).

## What gets wiped

For every `clients` row with `lower(email) = 'chris.tuite@compass.com'` (across all agents) and the matching `auth.users` row if one exists:

1. **Hot sheet workflow data** (scoped to any hot sheets where this person is the buyer):
   - `hot_sheet_sent_listings`, `hot_sheet_comments`, `hot_sheet_listing_status`, `hot_sheet_notifications`, `hot_sheet_favorites`
   - `hot_sheet_clients` membership rows
   - `hot_sheets` rows where `client_id` matches
2. **Relationships**: `client_agent_relationships` rows where `client_id` or `crm_client_id` matches any of the above
3. **CRM contact rows**: `clients` rows with that email (every agent's copy)
4. **Auth user** (if Chris ever signed up): the `auth.users` row + cascading auth-side data (profiles, user_roles, favorites, buyer_qualifications, buyer_credentials, notification_preferences, conversation_participants, hot_sheet_comments by sender, etc.) — handled by calling the existing `delete-users` Edge Function with `emails: ['chris.tuite@compass.com']`, which already does this cleanup safely.
5. **Email plumbing** (so re-sends aren't suppressed): remove `chris.tuite@compass.com` from `suppressed_emails` and `email_unsubscribe_tokens`.

## Implementation

### Step 1 — Migration: wipe CRM-side data
New migration `wipe_chris_tuite_compass_test_data.sql`:
```text
- gather client_ids: SELECT id FROM clients WHERE lower(email)='chris.tuite@compass.com'
- gather hot_sheet_ids: SELECT id FROM hot_sheets WHERE client_id IN (...)
- delete from hot_sheet_sent_listings/comments/listing_status/notifications/favorites WHERE hot_sheet_id IN (...)
- delete from hot_sheet_clients WHERE hot_sheet_id IN (...) OR client_id IN (...)
- delete from hot_sheets WHERE id IN (...)
- delete from client_agent_relationships WHERE client_id IN (...) OR crm_client_id IN (...)
- delete from suppressed_emails WHERE lower(email)='chris.tuite@compass.com'
- delete from email_unsubscribe_tokens WHERE lower(email)='chris.tuite@compass.com'
- delete from clients WHERE lower(email)='chris.tuite@compass.com'
```
Wrapped in a `DO $$ ... $$` block so it's transactional.

### Step 2 — Invoke `delete-users` for the auth account
After migration is applied, call the existing `delete-users` Edge Function once with `{ emails: ['chris.tuite@compass.com'] }`. It already handles auth.users deletion + FK blocker cleanup (profiles, user_roles, etc.). If no auth user exists, it returns "not found" gracefully.

## Files
- `supabase/migrations/<timestamp>_wipe_chris_tuite_compass_test_data.sql` (new)

## Verification (after run)
- `SELECT count(*) FROM clients WHERE lower(email)='chris.tuite@compass.com'` → 0
- `SELECT count(*) FROM client_agent_relationships ...` → 0
- `SELECT count(*) FROM suppressed_emails WHERE lower(email)='chris.tuite@compass.com'` → 0
- Auth listing → no user with that email
- You can now re-add him from My Buyers without 23505 and the welcome email will fire fresh.

