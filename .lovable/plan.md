# Fix the missing Login button + unblock the attachments release

Two separate things are going on. Neither is a broken login, and neither is a bug in the attachment work.

## 1. The Login control is there, but it doesn't look like a button

On the preview homepage at your window size, the header shows a green **Request Access** pill and, to its right, the word **Login** as plain low-contrast text on the dark hero photo. It works, but it reads as body text, not a control — which is why it looks like there is no login button.

Change (presentation only, marketing homepage header):

- Give **Login** a real button treatment: outlined pill, same height and radius as Request Access, brand tokens, with a label that stays readable against the dark hero.
- Keep Request Access as the primary action; Login stays secondary, immediately to its right.
- Keep the existing route and click behavior exactly as-is.
- Check desktop, tablet, and mobile widths, and confirm the mobile menu still exposes Login.

No auth logic, no routing, no other header items touched.

## 2. Attachments aren't live because publishing is blocked

The Communications Center photo/video attachment work is finished, and the backend piece is already deployed to production. The frontend is not live yet: the publish attempt was rejected by the security gate over two pre-existing critical findings that have nothing to do with attachments.

The two blockers:

- **listing_price_history** accepts inserts from anyone, with no check that the writer is the listing's agent — so fake price-change history can be injected.
- **listing_stats** has a single policy letting anyone read and write view/save/contact/share counts on any listing.

Until those are closed, no frontend change can ship — including attachments.

Proposed fix, one migration, scoped to those two tables:

- Remove the public write policies on both tables.
- Allow inserts to `listing_price_history` only from the listing's own agent (or trusted server-side code).
- Make `listing_stats` writable only by trusted server-side/service paths; keep reads as they are today.
- Confirm the app paths that write these tables still work: price-history rows on a listing price edit, and the view/save/contact/share counters on listing detail.

Then publish, and re-run the no-send verification: composer shows **Add photos or video**, the feed loads normally with no `broadcast` parameter, older broadcasts without attachments still render, and nothing new lands in the email queue.

## Still not doing

No test broadcast and no email of any kind. That stays a separate, explicitly authorized step after this publishes clean.

## Technical notes

- Header edit is confined to the marketing homepage header component; styling uses existing brand tokens, no raw color utilities.
- Security fix is a single migration touching only `listing_price_history` and `listing_stats` policies. The two related warn-level findings (`listing_status_history`, `share_tokens`) are out of scope unless you want them included.
- Order: migration, verify the two listing write paths, publish the frontend, then the read-only production checks.