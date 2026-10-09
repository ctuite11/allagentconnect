# Urgent: draft went live and sent Hot Sheet emails

## Evidence collected so far (read-only)
- Listing: 234 Friend Street (L-1430, id `541e6a81-c977-41fb-83e0-1f37b6461ad9`), your account.
- Timeline (ET), from the status history and audit records, all saved from the app under your login:
  - 12:51 created as Draft
  - 12:59:26 Draft → **Coming Soon** (not Off Market)
  - 12:59:59 saved again, still Coming Soon
  - 1:00:12 Coming Soon → Off Market
  - 1:01:53 Off Market → Cancelled (current status)
- The listing currently has no saved "intended status" for its draft.
- Hot Sheets: 3 listing events (one per status change, all processed) and 8 delivery records starting 1:00:06 PM.
- Emails for this listing: 8 already **sent** (4 new-match, 4 status-change). None of them are still pending, so nothing for this listing can be stopped.
- One unrelated item is still waiting in the email queue. It is not part of this listing. I'll identify it, but I won't touch it.
- The draft-protection code (keep the status as Draft and remember the chosen status separately) is in current `main`.

## Plan
1. **Containment (needs your OK):** turn on the existing Hot Sheet email pause switch so no listing change can send Hot Sheet email until we're done. No restarts or resizing.
2. **Find the exact save that did it (read-only):**
   - Work out which production build was live at 12:59 PM, and whether it already had the draft protection.
   - Trace every way the listing can be saved: auto-save, Save Draft, the Status selector, saves when moving to photos, floor plans, or documents, the Publish button with its confirmation, and anything on the database side.
   - Match the 12:59:26 save, which went to Coming Soon, against them.
3. **Report the root cause and evidence to you before any fix**, then stop.
4. **After you approve:**
   - Fix only that save so a Draft's status stays Draft until you press Publish and confirm.
   - Return 234 Friend Street to Draft, keeping all incident records.
   - Run the no-email QA on a throwaway draft: pick Off Market, wait past auto-save, go to Photos and back, Save Draft, reopen. At each step check that the status is still Draft, the intended status is Off Market, and there are no Hot Sheet events, deliveries, or emails.
   - Then confirm that only Publish with its confirmation takes a draft live.
5. Keep Hot Sheet emails paused until you say to turn them back on.

## Not done
No listing edits, no deletions, no changes to other queued emails, and no deploys until approved.
