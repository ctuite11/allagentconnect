## Plan

Fix the Hot Sheet Review comment button so it no longer depends on a fresh `clients` lookup before deciding whether the buyer has an email.

### What I’ll change

1. **Use the already-loaded recipient email first**
   - In `src/pages/HotSheetReview.tsx`, update `onOpenChat` to build buyer candidates from `reviewRecipients` first.
   - This uses the same email/name data already displayed on the buyer strip, so the flow won’t falsely say “no contact info” when the buyer email is already on the page.

2. **Resolve accepted buyers more robustly**
   - Keep the Favorites-style `clients.email → profiles.email → profiles.id` lookup.
   - Also allow accepted invite token resolution (`share_tokens.accepted_by_user_id`) for the same CRM client/email, because accepted invites are the authoritative proof that the buyer has an auth account.
   - Prefer any existing `reviewRecipients[].authUserId` before doing extra network lookups.

3. **Fix the fallback behavior**
   - Only show “This buyer has no contact info” when every candidate truly lacks an email.
   - If an email exists but no buyer auth id is found, show the invite/resend dialog instead of the no-email error.

4. **Validate the exact path**
   - Check the comment button path after the change by verifying the code path now opens `ListingConversationSheet` when a buyer email or accepted invite id is available.
   - No UI redesign, no database schema changes, and no unrelated files.