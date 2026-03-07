

## Remove Delete Option from Non-Draft Listings

Grid view (lines 542-562) is already correct — the 3-dot menu only renders when `l.status === "draft"`.

List view (lines 745-760) is the problem — the `DropdownMenu` with "Delete Listing" renders for **every** listing regardless of status.

### Change

**`src/pages/MyListings.tsx` — lines 745-760**

Wrap the existing `DropdownMenu` block in a `{l.status === "draft" && (...)}` conditional, so the 3-dot delete menu only appears on draft rows in list view.

Single change, single file. No other modifications needed.

