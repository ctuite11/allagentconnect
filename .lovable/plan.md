

## Fix: Unify icon colors to full AAC blue

**File**: `src/components/listing-search/SearchListingCard.tsx`

Only the icon element classes change. All surrounding `<span>`, `<a>`, `<div>` text classes remain untouched.

| Line | Icon | Current class | New class | Text unchanged? |
|------|------|--------------|-----------|----------------|
| 320 | `Camera` | `text-primary/50` | `text-primary` | ✓ `text-sm text-muted-foreground/80` on parent span |
| 325 | `FileText` | `text-primary/50` | `text-primary` | ✓ `text-sm text-muted-foreground/80` on parent span |
| 390 | `MapPin` | `text-primary/60` | `text-primary` | ✓ `text-xs text-muted-foreground` on parent div |
| 571 | `Mail` | (inherits muted) | `text-primary` | ✓ `text-sm font-medium text-muted-foreground` on parent button |

No font size, font weight, or text color changes on any label or parent element.

