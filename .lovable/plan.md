# My Listings: default view shows everything, including Drafts

## Current behavior (verified in code)
- `src/pages/MyListings.tsx` line ~528: when no status filter is selected, the page hides all Drafts (`listings.filter((l) => l.status !== "draft")`).
- Line ~420: an effect force-selects the Draft filter and rewrites the URL to `?status=draft` for agents who own only drafts.
- Default sort is already `created_at` (newest first), computed client-side on every render — edits, price changes, and status changes cannot move a listing's position.

## Changes (MyListings.tsx only)
1. **New default rule — no status selected = show all loaded listings**, including Drafts. Replace the special-case block with:
   - No statuses selected → show every loaded listing.
   - Statuses selected → show only matching statuses (legacy `canceled` still normalizes to `cancelled`).
2. **Remove the drafts-only auto-select effect** (the one that force-picks Draft and rewrites the URL to `?status=draft`). An agent with only drafts simply sees their drafts in the default view, no URL change.
3. **Remove the "Showing drafts because you don't have published listings yet" notice** and its `hasOnlyDrafts`/`nonDraftListings` helpers if nothing else uses them — the special case they exist for is gone.
4. **Draft bulk-select toolbar**: draft checkboxes appear on draft cards in the default view too now, but the bulk toolbar only renders when the Draft filter is on. Show the toolbar whenever any draft is selected OR the Draft filter is on, so selections are never invisible.
5. **Sorting untouched**: default stays Date (newest) by `created_at`; the other Sort options (Days on market, Price, Status) keep working. Sort never reorders on edits/price changes/status changes.
6. **Kept as-is**: Sale/Rental toggle, search box, status filter buttons, Sort control, URL `?status=` read/write behavior, Draft bulk delete, Quick Edit, card actions, the 17-status filter list, plain `withdrawn` exclusion, and legacy `canceled` handling.

## Not changing
Add/Edit Listing, Hot Sheets, emails, social posting, DCMLS, listing status behavior, the database, or any other page.

## Technical details
- File: `src/pages/MyListings.tsx` only.
- `filteredListings` (line ~528): default branch becomes `selectedStatuses.size === 0 ? listings : listings.filter(...)`.
- Delete the `useEffect` at line ~420 that auto-selects Draft, and the `nonDraftListings`/`hasOnlyDrafts` memo (line ~408) plus the notice block at line ~744 if now unused.
- Bulk toolbar condition (line ~717): `(selectedStatuses.has("draft") || selectedDraftIds.size > 0) && draftListings.length > 0`.
- Heads-up: saving to GitHub main makes this live on allagentconnect.com right away.
