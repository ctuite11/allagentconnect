# Archive Buyer↔Agent Threads on Removal; Fresh Thread on Re-invite

## Problem

`agent_end_client_relationship` ends the relationship and clears hot sheets but doesn't touch `conversation_participants`. On re-invite, `findOrCreateConversation` finds the old `conversations` row and unarchives it, restoring the old thread with full history in both inboxes.

## Changes

### Migration: `supabase/migrations/20260523120000_archive_buyer_agent_conversations_on_remove.sql`
- New `archive_conversations_between_users(user_a uuid, user_b uuid)` — sets `is_archived = true` on every `conversation_participants` row for both users on conversations where they are both participants.
- Update `agent_end_client_relationship` and `agent_end_client_relationship_by_id` to call it after ending the relationship and clearing hot sheets.

### `src/lib/startConversation.ts`
- In `findOrCreateConversation`, when an existing conversation's participant rows are archived for **both** sides, skip it and insert a fresh `conversations` row.
- Remove the auto-unarchive on find/create.
- Direct thread open via `useConversation` still unarchives (explicit user action) — unchanged.

## Behavior

- Remove buyer → both inboxes lose the thread; messages remain in DB.
- Re-invite → next "start chat" creates a brand-new conversation; only the new thread appears.
- Old archived threads still accessible by direct URL (audit trail).

## Out of scope

- No changes to CRM contacts, `agent_reactivate_buyer`, invite acceptance, manual archive UI, hot sheet comments, or `revoke-buyer-auth`.
