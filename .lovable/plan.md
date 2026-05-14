## Listing Card Banner Updates

Edit `src/components/ListingCard.tsx`:

1. **NEW LISTING** (active status path, ~line 548–558): change `daysSinceActive <= 7` → 48-hour check (compute hours since `mostRecentActiveDate`, show if `<= 48`).

2. **BACK ON MARKET** (~line 579): change `daysSinceChange <= 14` → 48-hour check.

3. **PRICE REDUCED** (~line 590–608): 
   - Change duration from 14 days → 48 hours.
   - Only return a banner when `new_price < old_price` (decrease). For increases, return `null` — no "PRICE CHANGE" amber banner.

No other behavior changes. The "BROKER OPEN HOUSE / OPEN HOUSE" and "COMING SOON" banners are event/status driven (not duration-based) and remain unchanged.

### Resulting durations
| Banner | New rule |
|---|---|
| NEW LISTING (active) | 48 hours from active date |
| BACK ON MARKET | 48 hours from change |
| PRICE REDUCED | 48 hours from price drop |
| PRICE CHANGE (increase) | Removed |
