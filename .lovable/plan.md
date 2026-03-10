

## Fix: Status on same line as ID and Price

**Root cause**: The parent flex has `items-start` (top-aligned), but the status zone overrides with `self-center`, which pushes it to the vertical midpoint of the tallest sibling — dropping it below the ID and Price.

**Fix (line 367)**: Change `self-center` to `self-start` so the status sits at the top baseline alongside the Listing ID and Price.

```
// Before
<div className="flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[100px] self-center">

// After
<div className="flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[100px]">
```

One line change. No other modifications.

