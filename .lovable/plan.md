

# Fix: Delete Button Always Red + Pending Changes

## All Changes (in `src/pages/MyListings.tsx`)

### 1. Delete buttons — always red (not just on hover)
Both Delete buttons (Open House line 757-762, Broker Tour line 783-788) change from `text-primary hover:text-primary/80` to `text-red-600 hover:text-red-700`.

### 2. Move status badge to top-right corner
Remove `ListingStatusBadge` from line 666 (center column, inline with listing number). Place it as an absolute-positioned element in the top-right of the card. The listing type badge stays next to the listing number.

### 3. Replace Open House icon
Line 745: change `📍` to `🎈`.

### 4. Add two new statuses
Add `"temporarily_withdrawn"` and `"cancelled"` to the `ListingStatus` type (line 37) and `PIPELINE_STATUSES` array (line 40).

---

### Technical Detail

**Delete button class change (lines 757-762 and 783-788):**
- From: `text-xs text-primary hover:text-primary/80 hover:underline shrink-0`
- To: `text-xs text-red-600 hover:text-red-700 hover:underline shrink-0`

**Status badge repositioning:**
- Add `relative` to the card's content container (around line 642)
- Remove `ListingStatusBadge` from line 666
- Add: `<div className="absolute top-0 right-0"><ListingStatusBadge status={l.status} size="sm" /></div>`
- Listing number row becomes: `#L-1002 . [For Sale]`

**Icon swap (line 745):**
- `📍` becomes `🎈`

**Status expansion (lines 37-40):**
```
type ListingStatus = "new" | "active" | "coming_soon" | "off_market" | "back_on_market" | "temporarily_withdrawn" | "cancelled";
const PIPELINE_STATUSES: ListingStatus[] = ["active", "new", "coming_soon", "off_market", "back_on_market", "temporarily_withdrawn", "cancelled"];
```

| File | Changes |
|------|---------|
| `src/pages/MyListings.tsx` | Delete buttons always red; status badge to top-right; icon swap; add two statuses |

No other files changed.
