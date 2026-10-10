# Server-side Draft → Live guard (plan only — no backend change until approved)

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

## 2. How direct Draft → Live writes get blocked
A new BEFORE UPDATE trigger on `listings`: when `OLD.status = 'draft'` and `NEW.status <> 'draft'`, raise an error unless a transaction-local setting `aac.publish_op` is set. Only the publish function can set that setting, and it does so inside its own transaction with `set_config(..., true)`. A browser request cannot set it through the normal data API, so no client boolean acts as the security boundary.
- A BEFORE INSERT rule rejects new rows inserted straight into a live status by the `authenticated` role. First-time creation must insert as `draft`, then publish. Service role and admin inserts are still allowed.
- Live → live changes are unaffected: cancel, back on market, the scheduled activation jobs, and price edits.
- Open decision: should Draft → Cancelled / Withdrawn (non-live) also be allowed? Proposed: yes. The guard covers only live statuses: coming_soon, new, active, back_on_market, off_market, and the rental equivalents.

## 3. The dedicated publish operation
A new DB function `publish_listing(p_listing_id uuid, p_target_status text, p_operation_id uuid)`, SECURITY DEFINER:
- Checks that the caller owns the listing, or is an authorized delegate or admin, using existing helpers (`can_act_for_agent`)
- Checks that the stored status is `draft` and the target is a live status
- Runs the required server-side publish checks (address, price, minimum photos), matching the client rules
- Sets `aac.publish_op`, updates the status, and clears `draft_intended_status`
- Writes one row to a new `listing_publish_audit` table: listing_id, user_id, previous_status, new_status, created_at, operation_id, source
- Idempotent on `p_operation_id`. A retry with the same ID returns the earlier result.

Client changes:
- Add/Edit/Rental: the explicit save always writes fields with `status='draft'` for a stored Draft. Only **Ready to publish? → Confirm** calls `publish_listing`, then reloads.
- The confirmed state becomes a value passed straight from `handleConfirmPublish` into the save. The long-lived ref is removed, which fixes the leak described above.

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
- Use a test Draft on the cancelled 28 Atlantic Ave listing, or a new test Draft
  - A direct REST update draft → coming_soon as the agent is **rejected**
  - Save Changes / Save Draft keep it as Draft
  - Reproduce the old ref leak (Confirm → validation error → fix → Save): it now shows the dialog again and does not publish
  - Confirm → `publish_listing` → goes live, and exactly one audit row is written
  - A retry with the same operation ID writes no second row
  - Live → Cancelled, and the scheduled activation running on a coming_soon test listing, still work
- Return the test listing to its original state, check that queue counts are unchanged and new Hot Sheet events come only from the test, then turn emails back on only with Chris's go-ahead
- Release goes through GitHub main → allagentconnect.com, with a live check that ends at the confirm dialog

## Out of scope
Email templates, Hot Sheet rules and matching, social publishing, DCMLS, and existing listing data.
