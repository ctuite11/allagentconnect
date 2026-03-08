

## Plan: Fix Missing Hover Lift on Listing Cards

The `CardSurface` component has the hover lift (`interactive` prop), and the grid-view cards pass `interactive` — so those should work. But the **list-view** cards (line 649) do **not** pass `interactive`, so they won't have the hover effect.

However, the user says they don't see lift at all. The issue is likely that `shadow-md` (the base) to `shadow-lg` (hover) is a very subtle change, and `will-change-transform` is missing so the `-translate-y` may not render smoothly on all browsers.

### Changes

**File: `src/components/ui/CardSurface.tsx`**

1. Add `will-change-transform` to the interactive class so the GPU handles the lift smoothly
2. Ensure the base shadow is lighter (`shadow-sm`) so the hover shadow (`shadow-lg`) contrast is more visible

```tsx
"bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden",
interactive && "will-change-transform transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] focus-within:shadow-lg",
```

**File: `src/pages/MyListings.tsx`** (line 649–651)

Add `interactive` to the list-view cards too:

```tsx
<CardSurface key={l.id} interactive className="relative p-4">
```

