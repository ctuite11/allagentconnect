# Fix: new Hot Sheet → send selected listings to the buyer already attached

## Why it's broken (trace)
- After saving, a new Hot Sheet opens Review Matches with its buyer linked. That page reuses the generic results layout, so it shows a **"Share selected"** button that opens the contact picker.
- The page's own send button only works for buyers who haven't accepted an invite yet. A connected buyer, or one invited from another Hot Sheet, sees a greyed-out **"Hot Sheet Sent"**, so the generic share is the only way left.
- Problems in the current send steps:
  - The invite send queues **only the invitation**, not the selected listings.
  - The listings send only reaches buyers who accepted an invite **for this exact Hot Sheet**. A connected buyer on a brand-new Hot Sheet would silently get nothing.
  - None of today's records reliably shows that the first batch went out. Accepting an invite records the current matches as already seen without emailing anything.

## Fix
1. **Review Matches only:** remove "Share selected". Listing Search and its share window stay unchanged.
2. **One Hot Sheet send button in the toolbar.** It sends to the buyer(s) linked to this Hot Sheet and stays disabled until at least one listing is selected.
   - Buyer not yet connected: **Send Listings & Invite**
   - Buyer connected: **Send Listings**
   - Mixed buyers: one click handles each buyer the right way.
   - Buyer has no email: disabled, with "Add an email to this buyer first".
3. **One send action that delivers what the button says:**
   - Connected buyers linked to this Hot Sheet get the selected listings without needing another invite. This applies to a manual first send only; automatic alert eligibility does not change.
   - Not-yet-connected buyers get the existing invitation. The selected listings are tied to that invitation, so they are what the buyer sees when they accept.
   - Listings are never marked as sent to a pending buyer unless that buyer actually receives or opens that batch.
4. **A dedicated "first batch sent" timestamp per Hot Sheet.** It is recorded only after the selected batch was successfully queued for the linked buyer(s).
   - **"Hot Sheet Sent"** shows only when this Hot Sheet's first batch has actually gone out.
   - It never shows just because the buyer has AAC access, has an agent relationship, was invited from another Hot Sheet, or had an invite email queued.
   - After the first batch, the agent can still select more unsent listings and press **Send Listings** again.

## Not changing
Listing Search sharing, automatic Hot Sheet alert rules, email templates, the invite email itself, matching, the household (shared) view, and delete/end-relationship.

## QA: no real sends
1. Never-invited test contact: new Hot Sheet → Review Matches → buyer attached, no "Share selected" → after selecting a listing the button says **Send Listings & Invite**.
2. Connected test buyer: same steps → no contact picker → **Send Listings**.
3. Connected buyer on a brand-new Hot Sheet does not show "Hot Sheet Sent".
4. Mixed buyers each get the right treatment.
5. Neither send button is pressed. Test Hot Sheets are deleted afterward.
No emails, invitations, Hot Sheet sends, or social activity.

## Technical details
- `HotSheetReview.tsx`: set `shareSelectedEnabled={false}` and put a new `HotSheetSendAction` in `toolbarActionsExtra`.
- New handler `sendHotSheetBatch()`:
  - Pending recipients: run the existing invite logic, storing the selected listing IDs in the invite token payload as `initial_listing_ids`. Acceptance then sends a baseline of only those IDs.
  - Connected recipients: call `process-hot-sheet` with `sendInitialBatch: true, selectedListingIds, manualRecipientsFromHotSheetClients: true`.
- `process-hot-sheet` (manual initial-batch path only): when that flag is set, add recipients from `hot_sheet_clients` whose client has an active `client_agent_relationships` row with a linked buyer `user_id`. Do not touch the cron/automatic path. Write `hot_sheet_sent_listings` only for actually queued recipients, and set `initial_batch_sent_at` only on successful enqueue. Stop updating `last_sent_at` when nobody received the batch.
- Migration: `ALTER TABLE hot_sheets ADD COLUMN initial_batch_sent_at timestamptz NULL` (additive). No backfill; existing Hot Sheets read as "not sent" until their next send.
- `inviteCta` logic is driven by `initial_batch_sent_at` plus each recipient's status, not by `allInviteAccepted`.
- Redeploy only `process-hot-sheet` and `accept-client-hot-sheet-invite`, and only if that function needs the `initial_listing_ids` change. Templates are untouched.
