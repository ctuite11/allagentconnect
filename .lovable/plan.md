# Fix: Send First Batch fails with "Listings could not be sent"

## Root cause (confirmed)

The 01:28:04 UTC request to `process-hot-sheet` (Hot Sheet "Buyer 1 Boston Condo's", 8 listings) reached the function and was rejected with **403 "Not allowed"** from the new recipient-branch ownership check.

The check calls `supabaseClient.auth.getUser()` **without passing the caller's token**. In a server-side function there is no stored session, so `getUser()` short-circuits locally with "session missing" and returns no user — it never even calls the auth server (confirmed: no `/user` request in the auth logs at 01:28:04, while the page's own session check at 01:27:42 succeeded). With no user id, `allowed` stays false and every non-service-role caller — including the sheet's owner — gets 403.

Evidence:
- Edge log: `POST | 403 | process-hot-sheet`, 484 ms, 01:28:04 UTC; function logged the request then returned with no error line (the 403 path has no logging).
- Hot sheet `a9b766f1-6f56-4fd1-ad57-3ad335833b87` is owned by Chris (`1fc50da1-…`); buyer `chris.tuite@compass.com` is attached, not yet connected (no relationship row) — so a successful send would have stored the pending first batch, not emailed anyone.
- `hot_sheet_recipient_batches` schema is correct (incl. `recipient_user_id`); no email jobs were created; nothing was sent.

## Fix (one function, one spot)

In `supabase/functions/process-hot-sheet/index.ts`, recipient branch only:

1. Extract the token from the `Authorization` header and pass it explicitly:
   `supabaseClient.auth.getUser(token)` instead of `getUser()`.
2. Add a `console.warn` on the 403 path (with the reason: no user vs. not owner/delegate) so any future rejection is visible in logs.

No changes to matching, cooldowns, dedupe logic, the pending-buyer store-and-deliver flow, email templates, or any UI.

## Verification

1. Deploy `process-hot-sheet`.
2. Browser check on the review page (no Send pressed): confirm the page still renders and the button states are unchanged.
3. **One controlled test send** on "Buyer 1 Boston Condo's" (buyer is pending/not connected, so the expected result is: selected IDs stored with the invitation, `pending_invite` state returned, success toast, **zero emails enqueued**). Verify in the database: `hot_sheet_recipient_batches` row present with the 8 selected IDs, `email_jobs` unchanged, no invite email triggered by this path.
4. Confirm the "Also email me a copy" behavior is untouched (agent copy only enqueues for connected-buyer sends, as before).
5. Report the exact cause, fix, and test result before anything is published.

## Explicitly not in scope

- No repeated send attempts while diagnosing.
- No changes to Hot Sheet matching, notification frequency, selection behavior, or the new UI.
- No emails sent during diagnosis; the single controlled test above stores a pending batch only and sends nothing.
