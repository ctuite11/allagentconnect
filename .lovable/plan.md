## Why the email never went out

Looking at the session replay and console:
> `[handleSendInvites] Skipping dashboard invite — buyer already invited or in search (client a8e3f4d2…)`
> Toast: "No new search invitations needed — buyers were already invited or are in your search."

In `HotSheetReview.tsx`, a buyer is only emailed an invite when:

```
sendDashboardInvite = !buyerLinkedCrmIds.has(cid) && globalMerged.length === 0
```

`globalMerged` includes **every** prior `client_hotsheet_invite` share_token for that client_id or email — across all hot sheets, not just this one.

Chris still has 6 leftover invite tokens from prior sheets:

| token | hot_sheet_id | accepted_at |
|---|---|---|
| ede04a77… | 9484d0eb… | (pending) |
| d4566442… | ad0342d0… | (pending) |
| 13b2e731… | (none) | (pending) |
| cdad6591… | (none) | accepted 4/23 |
| 1b30f371… | (none) | accepted 4/22 |
| 767bb378… | (none) | accepted 4/20 |

Even though we hard-deleted Chris's auth user last turn, these share_tokens still exist, so the gate keeps returning `false` → no token created, no email enqueued, nothing reaches Resend.

## The fix

Wipe the leftover `client_hotsheet_invite` share_tokens (and their `invite_events`) for `chris.tuite@compass.com` / client `a8e3f4d2-da4e-4c64-9d1a-f9ff9764173e`. Then click **Send invites** again on this hot sheet — `globalMerged.length === 0` will be true, a fresh token is created, an `email_jobs` row is enqueued for `chris.tuite@compass.com`, and `process-email-queue` ships it to Resend.

### SQL to run

```sql
-- Delete invite_events first (FK to share_tokens)
DELETE FROM invite_events
WHERE client_id = 'a8e3f4d2-da4e-4c64-9d1a-f9ff9764173e'
   OR client_email ILIKE 'chris.tuite@compass.com';

-- Delete the 6 leftover hot-sheet invite tokens
DELETE FROM share_tokens
WHERE payload->>'type' = 'client_hotsheet_invite'
  AND (
    payload->>'client_id' = 'a8e3f4d2-da4e-4c64-9d1a-f9ff9764173e'
    OR lower(payload->>'client_email') = 'chris.tuite@compass.com'
  );
```

After that you re-click **Send invites** on hot sheet `48b197db…` and the email goes out.

## Optional follow-up (not part of this fix)

The `delete_user_account_cascade` / hard-delete flow used last turn should also clean up `share_tokens` of type `client_hotsheet_invite` for the deleted user's email, otherwise we'll hit this same wall every time we re-add a deleted buyer. Happy to add that as a separate task if you want.

Confirm and I'll run the cleanup migration.