

# Fix: AAC List Date Showing Tomorrow Instead of Today

## Problem

When creating a listing, `list_date` defaults to `new Date().toISOString().split('T')[0]`. The `.toISOString()` method converts to **UTC**, so if you're in a US timezone (e.g., EST at 8pm = UTC 1am next day), the default date becomes **tomorrow**.

## Fix

### File: `src/pages/AddListing.tsx` (line 179)

Replace the UTC-based default:
```
list_date: new Date().toISOString().split('T')[0]
```

With a local-date default:
```
list_date: new Date().toLocaleDateString('en-CA')
```

`en-CA` locale produces `YYYY-MM-DD` format (what HTML date inputs expect), using the user's **local** timezone.

### Also apply the same pattern in `formatDate` (MyListings.tsx lines 83-88)

The `formatDate` function also has a timezone issue: `new Date("2026-02-08")` parses date-only strings as UTC midnight, which can shift the displayed date. Add timezone offset correction:

```
function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // If date-only string (no time component), adjust for UTC parse
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  }
  return d.toLocaleDateString();
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/AddListing.tsx` | Fix default `list_date` to use local date instead of UTC |
| `src/pages/MyListings.tsx` | Fix `formatDate` to handle date-only strings without timezone shift |

