

# Tighten Monogram-Wordmark Gap in HeroSection

## Change
In `src/components/home-v2/HeroSection.tsx`, reduce the gap between the AACMonogram icon and the "All Agent Connect" text from `gap-2.5` (10px) to `gap-1.5` (6px).

**Line 21:**
```
// Before
<div className="flex items-center gap-2.5">

// After
<div className="flex items-center gap-1.5">
```

Single line change, no other files affected.

