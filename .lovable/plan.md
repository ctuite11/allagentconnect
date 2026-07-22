## Delete Alice Miles (verified but never activated)

**Target agent**
- Name: Alice Miles
- Email: alice.miles@nemoves.com
- AAC ID: AAC-0287
- User ID: `7dfccf91-d337-46b5-851c-d4a76c21c3d3`
- State: verified 2026-07-18, never activated, no headshot, no last sign-in

### Plan

Use the existing hardened admin deletion path (`delete-users` edge function + `auth_user_deletion_queue` outbox with pg_cron retry) so nothing is left orphaned. Same flow used by the Admin Approvals "Delete" button — no new code.

1. Fire the pre-delete email `send-agent-account-removed-email` (per `enqueueVerifiedInactiveAgentRemovalEmail`) so she gets the standard removal notice before her `agent_settings` row goes away.
2. Invoke `delete-users` with `userIds: ["7dfccf91-…"]` and `emails: ["alice.miles@nemoves.com"]` (both, per the fix we shipped for the Yanis case) to:
   - Archive to `deleted_users`
   - Remove `agent_profiles`, `agent_settings`, `pending_verifications`, and related agent rows
   - Enqueue auth-user deletion in `auth_user_deletion_queue` for durable retry
3. Verify: re-query `agent_profiles`, `agent_settings`, and `pending_verifications` for that user_id / email — all should return zero rows. Confirm `deleted_users` has her archive and `auth_user_deletion_queue` shows the auth deletion as processed (or queued).

### Notes
- No schema changes, no new files. This is a one-off admin action executed against the existing pipeline.
- If you'd rather skip the removal email for someone who never activated, say so and I'll drop step 1.