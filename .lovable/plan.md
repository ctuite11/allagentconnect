# Deliver the correct AAC green monogram for phone download

## Problem
The file delivered earlier was not the AAC monogram. The real AAC green monogram is the command (⌘) mark in Emerald #22C55E — the exact SVG in `src/components/ui/AACMonogram.tsx`, used in the footer and unified email headers.

## What I'll deliver
Two files to Files (downloadable to phone):

1. **aac-green-monogram.png** — 1024×1024, transparent background, the exact ⌘ monogram paths from `AACMonogram.tsx` rendered in Emerald #22C55E, with comfortable padding around the mark.
2. **aac-green-monogram.svg** — the original vector, same paths and color, for perfect scaling.

## How
- Build the SVG from the exact five path elements in `src/components/ui/AACMonogram.tsx` (no redesign, no new artwork).
- Rasterize to 1024×1024 PNG with a transparent background.
- Save both to `/mnt/documents` so they appear as downloadable Files.

## Out of scope
- No changes to the app, brand assets bucket, or any code.
- No other monogram variants (multi-color marketing mark) unless requested.
