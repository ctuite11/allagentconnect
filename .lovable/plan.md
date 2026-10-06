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
   - **Connected buyer:** the selected listings are sent right away. This works even without an invite for this exact Hot Sheet. It applies to this manual send only; automatic alert rules do not change.
   - **Pending buyer:** gets the existing invitation, unchanged. The selected listings are saved for that buyer. When the buyer accepts, AAC uses the same listings send to deliver exactly those listings to that buyer. Only after that does AAC mark the remaining current matches as already seen. Saving the listings with the invite never counts as "sent".
4. **Track each buyer separately.** One record per Hot Sheet and buyer stores: the selected first-batch listings, when they were invited, and when the first batch was actually queued to them.
   - **"Hot Sheet Sent"** shows only when every buyer on this Hot Sheet has had the first batch queued. With mixed buyers, the page shows each buyer's own state (Invited, waiting to accept / Listings sent).
   - It never shows because of AAC access, an agent relationship, another Hot Sheet's invite, or a queued invite email.
   - After the first batch, the agent can select more unsent listings and press **Send Listings** again.

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
- `HotSheetReview.tsx`: set `shareSelectedEnabled={false}` and put a new `HotSheetSendAction` in `toolbarActionsExtra`. Button label and per-buyer state come from the new recipient records.
- **New table `hot_sheet_recipient_batches`** with unique (`hot_sheet_id`, `client_id`) and columns `initial_listing_ids uuid[]`, `invited_at`, `initial_batch_queued_at`, `delivered_to_user_id`, and timestamps. Includes GRANTs, RLS (owning agent or delegate can read; writes only through edge functions with service role), and an additive migration. It is the source of truth; no `hot_sheets.initial_batch_sent_at` column.
- **Connected buyers:** resolve through `client_agent_relationships` where `crm_client_id` is the attached CRM client, status is active, and `client_id` is the buyer's auth user. `process-hot-sheet` gets a manual-only flag, `recipientClientIds`. It delivers `selectedListingIds` to those resolved buyers. It writes `hot_sheet_sent_listings` and sets `initial_batch_queued_at` only for buyers actually queued, and updates `last_sent_at` only if at least one buyer was queued. The cron/automatic path is untouched.
- **Pending buyers:** the existing invite flow runs, then `initial_listing_ids` and `invited_at` are upserted. In `accept-client-hot-sheet-invite`, after the relationship is created, if that buyer has `initial_listing_ids` and no `initial_batch_queued_at`, it calls `process-hot-sheet` with `sendInitialBatch: true`, `selectedListingIds`, and `recipientClientIds` set to [that client]. Only after a successful queue does it set `initial_batch_queued_at` and then run the existing `baselineOnly` step for the rest. If delivery fails, acceptance still succeeds; the batch stays unsent and visible on the Review page.
- The email template is unchanged; the existing Hot Sheet listings email is reused. Only `process-hot-sheet` and `accept-client-hot-sheet-invite` are redeployed.
