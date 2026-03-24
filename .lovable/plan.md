

## Move Logo Further Inward

**File:** `src/pages/AgentProfile.tsx`

### Problem
The logo wrapper uses `ml-auto` which pushes it to the far right, and `pr-10 lg:pr-14` isn't enough inset.

### Fix
Replace `ml-auto self-center pr-10 lg:pr-14` with just `self-center` and remove the auto-push-right behavior. Instead, let the flex row's `gap-6` naturally space things, and give the identity column (Column 2) `flex-1` so it takes up the middle space, pushing the logo to a natural resting point within the content grid rather than the page edge.

**Line 257:** Add `flex-1` to Column 2's wrapper:
```tsx
<div className="flex flex-col justify-center min-w-0 pt-1 flex-1">
```

**Line 284:** Remove `ml-auto` and excessive padding from the logo wrapper:
```tsx
<div className="flex-shrink-0 self-center">
```

This makes the identity block fill available space and the logo sits naturally at the end of the content area, not pinned to the page edge.

