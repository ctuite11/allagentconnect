# Stop "new listing" alerts for listings that were never live

## The problem

This morning a brand-new listing (59 Court Street, Medford) was created, then moved from draft to off-market. That off-market step was treated as the listing's debut and sent 3 "new match" alerts to Hot Sheet recipients. Five minutes later it moved to coming-soon and sent 3 more "status change" alerts.

Recipients were introduced to a listing as off-market, then told it changed status — the opposite of the intended experience. A listing should only be introduced to the network when it is actually marketable.

## What changes

1. First-time announcements only fire for marketable statuses: new, coming soon, active, back on market.
2. Non-marketable statuses (off-market, draft, cancelled, expired, sold) never produce a "new listing" alert.
3. If a listing is skipped that way, no dedup record is written, so when it later becomes coming soon or active, that moment becomes the recipient's genuine first introduction — a proper new-listing alert, not a status-change note.
4. Listings already introduced while live keep behaving exactly as they do now: status changes still send status-change alerts.

## Safety boundaries

- No historical replay, retry, backfill, or resend of any kind.
- No changes to who is eligible, to Communications Center, or to unsubscribe/suppression logic.
- The periodic Hot Sheet sweep cron stays paused; this change only affects live listing events.

## Verification

- Walk a test listing through draft to off-market and confirm zero emails are queued.
- Move that same listing to coming soon and confirm recipients get one new-listing alert (not a status change).
- Confirm an already-live listing changing status still produces exactly one status-change alert.
- Confirm the email queue has no leftover or duplicate jobs afterward.

## Technical notes

- Edit `supabase/functions/send-new-match-notification/index.ts`: gate the new-match branch behind an allowlist of `new`, `coming_soon`, `active`, `back_on_market`; return early for other statuses without inserting into `hot_sheet_sent_listings`.
- Leave the status-change branch untouched — it already requires an existing `hot_sheet_sent_listings` row, so skipped listings cannot fall into it.
- Redeploy the function; no schema migration required.
