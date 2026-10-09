# Urgent: Quick Edit on My Listings published a draft

## Root cause (confirmed in code)
The **Quick Edit** button on a My Listings card saves the price and status you pick straight to the listing. It skips everything Add/Edit Listing uses to protect a draft: no keep-it-a-draft step, no required-field or photo checks, no duplicate check, and no "Ready to publish?" confirmation. The only check it runs is on price.

So saving a draft with a live status in Quick Edit makes the listing live right away. Hot Sheets treat that as a real status change, and emails go out. Quick Edit has worked this way since Nov 26, 2025. Its status list includes live statuses even when the listing is a draft.

## Evidence (read-only, already captured)
- 234 Friend Street (L-1430, id `541e6a81-c977-41fb-83e0-1f37b6461ad9`), saved from the app under your login.
- Times are ET. The records show a first save at 12:59:26 of **Draft → Coming Soon**, then Coming Soon → Off Market at 1:00:12, then → Cancelled at 1:01:53. The listing is Cancelled now.
- 3 Hot Sheet listing events and 8 delivery records. 8 emails went out (4 new-match, 4 status-change), and none are still pending, so nothing for this listing can be stopped.
- One unrelated email is still waiting in the queue. I won't touch it.

## Plan
1. **Containment:** turn on the existing Hot Sheet email pause switch. No restarts or resizing.
2. **Fix Quick Edit only:**
   - When a listing is a draft, Quick Edit lets you change the price only. Status changes are removed for drafts, with the note: "Open the listing and click Publish to make a draft live."
   - As a backstop, the Quick Edit save also refuses to move a draft to any live status.
   - Already-live listings keep today's Quick Edit behavior.
3. **Lock it with a test**: Quick Edit can never take a draft live.
4. **Return 234 Friend Street to Draft**, keeping all incident records (status history, audit, Hot Sheet events, deliveries, emails).
5. **QA with Hot Sheet emails paused, sending no email:**
   - On a throwaway draft, change the price in Quick Edit. It stays a draft, and the status choice isn't offered.
   - Check that the status is still Draft and there are zero Hot Sheet events, deliveries, or emails.
   - Confirm Edit Listing → Publish → confirmation still publishes.
6. Deploy the usual way (GitHub `main` → allagentconnect.com) and report the exact fix and results. Hot Sheet emails stay paused until you say to turn them back on.

## Not touched
Add/Edit Listing, Hot Sheet matching and templates, other queued emails, and other listings.

## Technical notes
- `src/pages/MyListings.tsx`: `saveQuickEdit` → `onQuickUpdate` → `supabase.from("listings").update({ price, status })`. The status list is `EDIT_STATUS_OPTIONS`, built from `EDITABLE_STATUSES`.
- Pause switch: `HOT_SHEET_EMAILS_PAUSED=true`, read by `assertHotSheetEnqueueAllowed` in `_shared/emailStreams.ts`.
- Revert: update `status='draft'` for that one listing by its id. The status-history trigger records the change.
