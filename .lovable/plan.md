

## Fix: Change Video/Tour icon color to AAC blue

**File**: `src/components/listing-search/SearchListingCard.tsx`

Change the `Video` icon on both Tour (line 336) and Video (line 347) links to use `text-primary` (AAC blue) while keeping the text label in `text-muted-foreground`.

### Changes

**Line 336** — Split the icon color from the link text:
```tsx
<Video className="h-4 w-4 text-primary" /> Tour
```

**Line 347** — Same change:
```tsx
<Video className="h-4 w-4 text-primary" /> Video
```

The link wrapper classes stay as `text-muted-foreground/80` so only the icon itself becomes AAC blue.

No other changes.

