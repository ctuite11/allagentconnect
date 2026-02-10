

# Eliminate White Space — Absolute-Position the Right Metadata Block

**Single file:** `src/pages/MyListings.tsx`

## Root Cause

The right-side metadata (Coming Soon, Listed, Exp, DOM, overflow menu) stacks 5 items vertically inside the action row's `flex justify-between` container (lines 629-652). This makes the action row ~100px tall, even though the left-side buttons are only one line. The content row (photo + listing data) starts below this tall container, creating the visible white band.

## Fix (2 edits, no layout redesign)

### Edit 1 — Line 568: Remove bottom margin from action row

```
Before: <div className="mb-1 flex justify-between items-start">
After:  <div className="flex justify-between items-start">
```

### Edit 2 — Line 629: Absolutely position the metadata block

```
Before: <div className="shrink-0 text-right space-y-0.5 pt-0.5">
After:  <div className="absolute top-4 right-4 text-right space-y-0.5">
```

The CardSurface already has `relative p-4` (line 565), so `absolute top-4 right-4` places the metadata exactly in the top-right corner with matching padding. It's removed from document flow, so the action row collapses to one-line height and the content row moves up immediately below.

## Why this is safe

- CardSurface already has `relative` — no new positioning context needed
- The metadata block was already visually in the top-right corner; this just formalizes it
- No overlap risk: the action buttons are left-aligned, the metadata is right-aligned
- No handler, data, or event logic changes
- No other files affected
