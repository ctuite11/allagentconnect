# Server-side Draft → Live guard (plan only — no backend change until approved)

## The one rule
A listing whose saved status is Draft can go live only through this sequence:
1. The agent clicks Publish.
2. The "Ready to publish?" dialog opens.
3. The agent clicks "Yes, Publish Listing" in that dialog.
4. Only that click calls `publish_listing()`, and the server changes the status from Draft to live.

Every other action leaves a saved Draft as Draft, whatever status is chosen in the form: Autosave, Save Draft, Save Changes, photo, floor-plan and document saves, Preview, Quick Edit, leaving the page and coming back, changing the status dropdown, and any ordinary `listings.update()`. Choosing a status only records `draft_intended_status`. If the agent cancels, the dialog is interrupted, validation fails, the agent navigates away, or the request fails, the listing stays Draft and the next attempt needs Publish → confirmation again. There is no reusable confirmation flag and no Save Changes path that can publish.


## Correction on 16 N Mead Street
The record shows Draft → Coming Soon at 17:58:44 UTC Oct 9, made from the Add Listing form under Chris's signed-in account. Nothing saved proves the "Ready to publish?" dialog was confirmed: there is no confirmation record and no publish marker. This plan does not treat it as an intentional publish.

## Finding on `publishConfirmedRef` (to confirm in step 1)
`handleConfirmPublish` sets `publishConfirmedRef = true` and then runs the save again. The flag is only cleared **after** the confirm gate (AddListing.tsx ~3230 and ~3670). Any early exit **before** the gate leaves the flag set to `true` for the rest of the session: a validation failure, the photo gate, a duplicate check, or a save already running. The next explicit save with a live status would then skip the dialog. One example: Confirm → validation error → fix the field → Save Changes. That is a believable way for a silent publish to happen. Step 1 tries to reproduce it in the preview without saving a live status. No browser test proves it yet.

## 1. Every path that can change `listings.status` today
Client (direct `listings.update/insert` under the agent's login):
- `AddListing.tsx`: autosave (draft only), Save Draft, Save Changes (`handleSaveChanges`), Publish (`handleSubmit`), concierge payload (status removed)
- `EditListing.tsx` (~line 251): general edit save
- `AddRentalListing.tsx`: insert/update with `publishNow ? formData.status : "draft"`
- `MyListings.tsx`: Quick Edit (Drafts are already price-only) plus the bulk/back-on-market path (~line 1340, sets `active`)
- Final step: run a full search for `.update(` on listings in `DraftListings`, `AgentListingDetail`, `ListingReview`, and `PriceDialog`, and list each one

Server:
- `update-listing-statuses` function (coming_soon/new → active)
- DB function `auto_activate_listings` (coming_soon → active)
- `admin-manage-concierge-listing` function (admin)
- `dcmls_participation_apply` (to be checked: DCMLS fields only, or status too)
- None of these start from `draft`, so the guard does not affect them

## 2. How direct Draft → any-status writes get blocked
A new BEFORE UPDATE trigger on `listings` raises an error whenever `OLD.status = 'draft'` and `NEW.status <> 'draft'`. The only exception is a transaction-local marker that only `publish_listing()` sets, internally, with `set_config(..., true)`. A browser request cannot set it through the normal data API, so no client boolean acts as the security boundary.
- **There are no status exceptions.** Coming Soon, Off Market, Active/New, Back on Market, Cancelled, Withdrawn/Temporary Withdrawn, Pending, Sold, Rented, Expired, and every other non-Draft status are all blocked. A never-published listing stays Draft until Publish → Ready to publish? → Yes, Publish Listing, or until it is deleted.
- **No admin or service escape.** The trigger runs for every role (authenticated, service role, admin, concierge, scheduled jobs). Concierge staff still cannot publish a member's Draft.
- A BEFORE INSERT rule makes every new listing insert as `draft`, for every role. Creation is always a Draft insert followed by `publish_listing()`.
- Processes that only touch already-live listings are unaffected: scheduled activation, live → live status changes, cancel/withdraw on live listings, and price edits.
- Before the guard migration, step 1 confirms that no existing server path moves a listing out of Draft (`admin-manage-concierge-listing`, `admin-create-listing-for-agent`, `dcmls_participation_apply`, `auto_activate_listings`, `update-listing-statuses`). Any path that does is moved to `publish_listing()` or stopped, and is reported before the change.

## 3. The dedicated publish operation
A new DB function `publish_listing(p_listing_id uuid, p_operation_id uuid)`, SECURITY DEFINER. It takes **no client-supplied status**. It:
- Locks the row (`SELECT … FOR UPDATE`)
- Checks that the caller is the listing agent or their authorized delegate (`can_act_for_agent`). Admin and concierge accounts get no publish right for another member's Draft.
- Checks that the stored status is `draft`
- Reads the stored `draft_intended_status` and checks it is a publishable status
- Runs the server-side publish checks (address, price, minimum photos, required fields), matching the client rules
- Sets the internal marker, changes the status to the intended status, and clears `draft_intended_status`
- Writes one row to the new `listing_publish_audit` table: listing_id, user_id, previous_status, new_status, created_at, operation_id, source
- Is idempotent on `p_operation_id`. A repeat call with the same ID after a success returns that success and writes nothing. An ID from a failed attempt is recorded as failed and can never authorize a later publish.

The invariant this gives: **no successful `listing_publish_audit` row from `publish_listing()` means the Draft could not have become published.**

Client changes:
- Add/Edit/Rental: whenever the saved status is Draft, every save path (autosave, Save Draft, Save Changes, media/document, Preview, navigation saves) writes `status='draft'` plus `draft_intended_status`. There are no exceptions.
- "Save Changes" no longer gets a first-publish branch. For a Draft it is only a field save.
- `publishConfirmedRef` is deleted. The "Yes, Publish Listing" click handler is the only place that calls `publish_listing`. It creates a **fresh `operation_id` at that click**, saves the fields as Draft, then makes the call. Nothing else imports or calls it, and a source test locks that in.
- If the dialog is cancelled, interrupted, or the attempt fails, the operation is discarded, the listing stays Draft, and the next attempt needs Publish → confirmation → a new final click.
- Quick Edit stays price-only for Drafts (already live).

## 4. Flows that could break
- Add Listing first insert straight to live: changes to insert as draft, then publish (two steps, same user experience)
- Rental "publish now" insert: same change
- `MyListings` back-on-market path: affects only non-draft listings. To be confirmed.
- Hot Sheet matching still fires on the status UPDATE through the existing `notify_matching_buyers_trigger`, so there is no change to matching or email logic
- Status history and audit triggers still fire as they do now

## 5. Migration and rollback
- Migration A: `listing_publish_audit` table (grants + RLS: owner/admin read, no client writes) plus the `publish_listing` function
- Deploy the frontend that uses `publish_listing` and run QA
- Migration B (separate, after the frontend is live): the guard trigger. This order means the live site never runs old code against the new guard.
- Rollback: `DROP TRIGGER` on the guard only. The function and audit table can stay; they are additive and harmless.

## 6. QA (Hot Sheet emails paused throughout)
- Set `HOT_SHEET_EMAILS_PAUSED=true` through the secure form before testing, and confirm the email queue counts first
- Use a **brand-new disposable test Draft** created only for this QA. No real listing (including 28 Atlantic) is touched.
  - Direct updates outside `publish_listing()` from Draft → Coming Soon, Cancelled, Off Market, and Active are all **rejected**, both as the agent and with the service role
  - Save Changes / Save Draft keep it as Draft
  - Reproduce the old ref leak (Confirm → validation error → fix → Save): it now shows the dialog again and does not publish
  - For a Draft with Coming Soon selected: Autosave, Save Draft, Save Changes, photo save, Preview, and leave-and-return each keep it as Draft
  - Cancel the dialog, then Save Changes: it stays Draft
  - A failed publish attempt's operation ID cannot authorize a later call
  - Yes, Publish Listing → `publish_listing` → publishes the saved intended status, and exactly one audit row is written
  - A retry with the same successful operation ID writes no second row
  - Live → Cancelled and scheduled activation still work on the now-live test listing
- Delete the test listing afterward, confirm queue counts are unchanged and any new Hot Sheet events came only from the test, then turn emails back on only with Chris's go-ahead
- Release goes through GitHub main → allagentconnect.com, with a live check that ends at the confirm dialog

## Out of scope
Email templates, Hot Sheet rules and matching, social publishing, DCMLS, and existing listing data.
