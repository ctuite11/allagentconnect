## Goal
Show the listing **street address** in two places where it's currently missing/inconsistent:

1. **Hot sheet emails sent to buyers** — invite teasers + any hot-sheet listing cards.
2. **Property share emails** — guarantee the address line always renders.

No other behavior, layout, or copy changes.

## Findings

- `supabase/functions/send-hot-sheet-invite/index.ts` builds `teasers` with only `price`, `cityState`, `bedsBaths`, `photoUrl` — **no street address** is selected from `listings` or passed through.
- `supabase/functions/_shared/renderEmailTemplate.ts` `case "hot-sheet-invite"` renders teaser cards showing only price + cityState/bedsBaths — **no address line**.
- `process-hot-sheet` and `send-new-match-notification` already include `listing.address` in their `listingsHtml`, so those are fine.
- `listing-share` and `bulk-listing-share` cards in `renderListingShareCard` already render `${address}`, but if `listing.address` is empty/missing the line collapses silently. We'll harden so the address line always renders (using a sensible fallback to the first line of `cityLine` only when truly absent — i.e., never produce a card with no address row).
- `send-favorites-share` passes `p.address` straight through — already shown.

## Changes

### 1. `supabase/functions/send-hot-sheet-invite/index.ts`
- Extend the `listings` select to include `address`.
- Add `address: listing?.address || ""` to each teaser object.
- Extend the `ListingTeaser` interface with `address: string`.

### 2. `supabase/functions/_shared/renderEmailTemplate.ts`
- In the `hot-sheet-invite` teaser HTML (inside the loop), insert a street address line above the existing cityState line:
  ```
  ${teaser.address ? `<p style="margin:0 0 2px;font-size:14px;color:#0f172a;font-weight:600;">${teaser.address}</p>` : ""}
  ```
- In `renderListingShareCard`, ensure the address `<p>` always renders. If `listing.address` is empty, fall back to `cityLine` for that row so a property share email never goes out without an address line.

### 3. Deploy both edge functions: `send-hot-sheet-invite`, plus any function that bundles `_shared/renderEmailTemplate.ts` (`process-email-queue` / email worker — confirm during build which functions need redeploy).

## Out of scope
- No changes to in-app hot sheet UI, no changes to subjects, CTAs, or styling beyond adding the address line.
- No DB schema or RLS changes.
- No edits to `process-hot-sheet`, `send-new-match-notification`, `send-favorites-share` (already render address).
