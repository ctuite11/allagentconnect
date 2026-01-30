
# Fix: Add Price to Social Share Title

## Problem
The social share preview shows the price only in the description, not in the title. Since social platforms display titles more prominently, the price isn't immediately visible.

## Current Behavior
| Field | Current Content |
|-------|-----------------|
| Title | `33 Sleeper St, Boston, MA - All Agent Connect` |
| Description | `$1,375,000 - 2 bed, 1 bath...` |

## Proposed Change
| Field | New Content |
|-------|-------------|
| Title | `$1,375,000 · 33 Sleeper St, Boston, MA` |
| Description | `2 bed, 1 bath. [listing description]` |

This puts the price front and center where social platforms display it most visibly.

---

## Technical Implementation

### File to Modify
`supabase/functions/social-preview/index.ts`

### Changes

**1. Update title format (line 79)**

Current:
```typescript
const title = `${listing.address}, ${listing.city}, ${listing.state} - All Agent Connect`;
```

New:
```typescript
const title = `${priceText} · ${listing.address}, ${listing.city}, ${listing.state}`;
```

**2. Update description format (lines 84-86)**

Current:
```typescript
const description = listing.description
  ? `${priceText} - ${listing.bedrooms ?? "?"} bed, ${listing.bathrooms ?? "?"} bath. ${String(listing.description).substring(0, 120)}...`
  : `${priceText} - ${listing.bedrooms ?? "?"} bed, ${listing.bathrooms ?? "?"} bath in ${listing.city}, ${listing.state}`;
```

New (remove price from description since it's in title):
```typescript
const bedsAndBaths = `${listing.bedrooms ?? "?"} bed, ${listing.bathrooms ?? "?"} bath`;
const description = listing.description
  ? `${bedsAndBaths}. ${String(listing.description).substring(0, 140)}...`
  : `${bedsAndBaths} in ${listing.city}, ${listing.state} | All Agent Connect`;
```

---

## Result Preview

**Facebook/LinkedIn/iMessage will show:**

```text
┌─────────────────────────────────────────────────┐
│  [Property Photo]                               │
│                                                 │
│  $1,375,000 · 33 Sleeper St, Boston, MA         │
│  2 bed, 1 bath. Beautiful waterfront property...│
└─────────────────────────────────────────────────┘
```

---

## Verification Steps

1. Deploy the updated edge function
2. Go to Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
3. Enter: `https://allagentconnect.com/property/f5aace9a-d002-4101-a42f-9505c1947362`
4. Click "Scrape Again" twice
5. Confirm the title now shows `$1,375,000 · 33 Sleeper St, Boston, MA`
