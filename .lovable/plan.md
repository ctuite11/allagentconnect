## Goal
Make every listing email render the same card as the in-app SearchListingCard (status banner, full-width photo, feature pill, price + ID, type, green-pin address, beds/baths/sqft, brokerage + agent). One renderer, used everywhere, replacing the current MLS and compact variants.

## New renderer
Add `renderSearchStyleListingEmailCard(listing, opts)` in `supabase/functions/_shared/listingEmailCard.ts` and a mirror in `src/lib/renderEmailListingCard.ts` (the share-email path uses the `src/lib` copy). Email-safe: nested `<table>`s, inline styles, no flex/grid/JS/hover.

Card structure, top to bottom:
1. **Status banner** — full-width strip, semantic status color (Active emerald, Coming Soon blue, Under Contract amber, Sold/Closed neutral). Centered, uppercase, e.g. "COMING SOON". No sparkle icon.
2. **Photo** — single full-width hero image, ~280–320px tall, `object-fit: cover`. No arrows, no checkbox. Whole image links to the listing.
3. **Feature pill** (optional) — small rounded white pill over the bottom-right of the photo (e.g. "Waterfront"). Only when `listing.features`/tags has a notable one; skip otherwise.
4. **Body padding 16–20px**:
   - Row 1: Price (left, bold 20px) · ID# L-XXXX (right, AAC primary blue, small).
   - Row 2: Property type (e.g. "Condo"), medium weight, neutral-700.
   - Row 3: Address with emerald map-pin glyph (`●` or inline SVG-safe character), single line, neutral-900.
   - Row 4: Stats row — Beds / Baths / Sqft separated by middots, with small inline glyphs (Unicode safe, not Lucide). No icons via SVG-in-img unless they're tiny inline-safe.
5. **Footer divider** + brokerage (left, neutral-500) · agent name (right, plain text per decision). No envelope icon, no link.

Tokens reused from existing card: `#0E56F5` (price/ID accent), `#22C55E`/`#50c878` (pin + emerald), neutral grays already in file.

Options: `{ baseUrl?, listingUrl?, ctaLabel? }`. CTA is implicit (whole card linked); we'll keep the existing per-email "Open Hot Sheet" / "View Listing" outer button outside the card unchanged.

## Replacements (all listing emails)
Swap every call site to the new renderer:

- `supabase/functions/_shared/listingEmailCard.ts` — keep file, add new export, mark old `renderListingEmailCard` / `renderCompactListingEmailCard` as deprecated aliases that forward to the new one (so any unmigrated path keeps working).
- `supabase/functions/process-hot-sheet/index.ts` — Hot Sheet invite + share emails.
- `supabase/functions/send-new-match-notification/index.ts` — match notifications.
- `supabase/functions/_shared/renderEmailTemplate.ts` — any listing block.
- `netlify/functions/email-worker.ts` and `netlify/functions/listingEmailCard.ts` — mirror the new renderer here (Netlify worker bundle).
- `src/lib/renderEmailListingCard.ts` + `src/lib/buildHotSheetShareEmailHtml.ts` — used by client-triggered listing shares.
- Anywhere `renderCompactListingEmailCard` is used (message notifications, listing inquiry, price-change alert) — switch to the new renderer.

## Deploy
Redeploy: `process-hot-sheet`, `send-new-match-notification`, `send-transactional-email` (if it imports the shared card), and any other edge functions touched. Netlify auto-deploys the worker.

## Test
After deploy:
1. Trigger one Hot Sheet invite to a test recipient → confirm new card.
2. Trigger one new-match notification → confirm.
3. Trigger one personal listing share → confirm.
4. Inspect rendering in Gmail web + iOS Mail (Outlook desktop strips a lot — accept graceful degradation).

## Out of scope
- No change to outer email shell (header, footer, "Open Hot Sheet" CTA, unsubscribe).
- No change to subjects, recipient logic, queueing, or cron cadence.
- No interactive carousel, checkbox, or hover states (email clients can't render them).
