# Hide 31 Pacella Drive from Success Hub Market Activity

## Goal

31 Pacella Drive, Dedham (L-1288, $799,000, Active) is already on MLS, so it should not appear in the Success Hub Market Activity feed. It stays fully in the system: searchable, viewable on its detail page, and still counted in the owning agent's listings. Status-change alerts continue to work normally.

Newer listings created as on-MLS are already excluded. This one predates that behavior, so it needs an explicit exclusion.

## Approach

Today Market Activity shows every listing except drafts and expired ones — there is no way to exclude an individual listing without changing its status, which would distort its record. The fix adds a simple per-listing switch.

1. Add a `hidden_from_market_activity` flag to listings, defaulting to off, so nothing else changes.
2. Market Activity skips any listing with the flag on. Search, listing detail, My Listings, Hot Sheets, and status-change alerts all ignore the flag and behave exactly as before.
3. Turn the flag on for 31 Pacella Drive only.

## What stays untouched

- No status change to the listing and no edit to its history.
- No listing data deleted.
- No changes to Hot Sheet matching, emails, crons, or any other agent's listings.
- No new UI controls in this change; the flag is set directly for this one listing.

## Verification

- Confirm 31 Pacella no longer appears in Market Activity on the Success Hub dashboard.
- Confirm it still appears in listing search and loads on its detail page.
- Confirm other listings in Market Activity are unaffected.

## Technical notes

- Migration: add `hidden_from_market_activity boolean not null default false` to `public.listings`. No policy changes needed; existing listing policies already cover the column.
- Frontend: add `.eq("hidden_from_market_activity", false)` to the pool query in `src/components/success-hub/MarketActivityRow.tsx`, and drop the flag in the realtime upsert path so a flagged listing never re-enters the feed on update.
- Data change: set the flag true for listing `35c69850-8110-4a05-a03c-e97b4d78401c` (L-1288).
