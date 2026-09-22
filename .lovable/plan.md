# Hot sheet: label matches by what actually changed

## What the records show

I checked 50 Proctor Avenue, the listing that went out at 02:30 UTC on 22 Sep to four hot sheets with the subject "New matches in your Hot Sheet".

- Its last real status change was **20 July** (new to off market). Nothing changed status on 22 Sep.
- Three edits were recorded on 22 Sep at 02:29 and 02:31, all "off market to off market" — attribute edits, not status changes.
- The 02:29 edit is what queued the match and produced the four emails.

So two things are true at once:

1. Emails are **not** limited to status changes. The queueing rule also fires on a change to price, beds, baths, square feet, lot size, parking, property type, listing type, city, county, neighborhood, state, or listing agent. That is why an edit with no status change sent mail.
2. The wording rule says "new match" whenever that hot sheet has **never** sent that listing before, at any status — regardless of how old the listing is or what actually changed. 50 Proctor had never been delivered to those four sheets, so it was labelled a new match even though it had been off market for 64 days.

## What to change

**1. Stop silent edits from sending anything.**
Only queue a match when something buyers care about happened: status change, price change, or the listing newly qualifying for that hot sheet's criteria. Edits to beds, baths, square feet, parking, lot size and similar corrections stop producing emails on their own.

**2. Label the email by the triggering event, not by send history.**
Carry the event's before/after status and price into the matcher, then pick the wording from it:

- Listing first published (or newly qualifies for the hot sheet) - "New match"
- Price went down or up - "Price change"
- Status changed - existing status-change wording (back on market, off market, coming soon, and so on)

An old listing surfacing in a hot sheet for the first time because of a price cut reads as "Price change", not "New match".

**3. Leave everything else intact.**
No change to matching criteria, the per-status duplicate guard, the delivery claim/idempotency layer, or the paused-send controls.

## Technical detail

- `notify_matching_buyers_on_new_listing` (trigger on `listings`): narrow the relevance test so a bare attribute edit no longer writes an outbox row; keep status and price in it, and keep criteria-affecting fields only where they can change qualification.
- `hot_sheet_listing_events`: add `old_price` / `new_price` alongside the existing `old_status` / `new_status` so the matcher can see the cause.
- `send-new-match-notification`: replace the "no prior send means new match" classifier with one driven by the event fields; fall back to today's behavior when a run has no event (manual send, initial batch).
- `hot_sheet_sent_listings` and `hot_sheet_delivery_claims` keys stay as they are.

## Verification before anything goes out

- Replay the 50 Proctor edit against the new rule and confirm it produces no email.
- Confirm a price cut on an existing off-market listing produces a "Price change" email, once per hot sheet.
- Confirm a brand-new listing still produces "New match".
- Confirm queue totals and the paused controls are unchanged, and no historical row is released.
