

# Show Client Comments on Hot Sheet Review Listing Cards

## Current State
- A client left a comment ("I like this one") on a listing in this hotsheet
- The `HotSheetReview` page fetches listings and renders them via `ListingCard`, but **never fetches `hot_sheet_comments`**
- The `ListingCard` component has no prop or UI for displaying a client comment
- Comments are only visible today through the `HotSheetCommentsDialog` (accessed from the Hot Sheets list page)

## Plan

### 1. Fetch comments in `HotSheetReview.tsx`
- After fetching the hotsheet and listings, query `hot_sheet_comments` for this hotsheet ID
- Build a `Map<listing_id, comment_text>` for quick lookup

### 2. Pass comment to each `ListingCard`
- Add an optional `clientComment?: string` prop to `ListingCard`
- In the listing grid, look up the comment for each listing and pass it through

### 3. Display the comment on the card
- When `clientComment` is present, render a small styled block below the listing details (inside the card)
- Visual treatment: a speech-bubble-style block with a `MessageSquare` icon, muted background, and the comment text
- Example placement: below the price/address section, above any action buttons

```text
+---------------------------+
|  [photo]                  |
|  $450,000                 |
|  123 Main St, Boston, MA  |
|  3 bd | 2 ba | 1,200 sqft |
|                           |
|  [MessageSquare] "I like  |
|   this one"               |
|                           |
+---------------------------+
```

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/pages/HotSheetReview.tsx` | Fetch `hot_sheet_comments`, build comment map, pass `clientComment` prop to `ListingCard` |
| `src/components/ListingCard.tsx` | Add optional `clientComment` prop, render comment block when present |

### No database or migration changes needed
The `hot_sheet_comments` table already exists and has the data. RLS policies already allow agents to read comments on their hotsheets.

