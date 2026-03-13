

# Plan: Ecosystem Section — AAC Brand Alignment + Background Cleanup

## Scope

Modify only `src/components/home-v2/EcosystemSection.tsx`. No layout, structure, spacing, or animation structure changes.

## Changes

### 1. Remove background nodes entirely

Delete the entire `ConstellationBackground` component (lines 158-235) and its usage (line 336). Remove the `Dot`, `Line`, `WakeNode` interfaces and all related imports (`AnimatePresence`). The background should be nearly blank — only the faint grid remains.

### 2. Remove ambient glow

Delete the ambient glow div (lines 347-349). No colored glow blobs.

### 3. Update color tokens

| Token | Current | New |
|-------|---------|-----|
| `CARD_BG_QUIET` | `rgba(255,255,255,0.78)` | `rgba(255,255,255,0.72)` |
| `GREEN` | `#059669` | `#22C55E` |

Remove `DOT_MUTED` (no longer used). Keep `LINE_MUTED` and `RING_MUTED`.

### 4. Restore brand color to icons

- **InputCard** icon color: change `rgba(59,130,246,0.7)` → `#0E56F5`
- **ResultCard** icon color: change `rgba(5,150,105,0.7)` → `#22C55E`

### 5. Restore brand color to connector lines

- **Left connectors** (line 385): change gray gradient to `linear-gradient(to right, rgba(14,86,245,0.18), rgba(14,86,245,0.06))`
- **Right connectors** (line 413): change gray gradient to `linear-gradient(to right, rgba(34,197,94,0.06), rgba(34,197,94,0.18))`

### 6. Update pulsing dots on cards

- **InputCard** pulsing dot: change `background: BLUE_ACCENT` → `background: BLUE` (#0E56F5)
- **ResultCard** pulsing dot: already uses `GREEN`, which is now `#22C55E`

### 7. Hub — no structural changes, keep as-is

The hub glows, rings, and orbit dots remain unchanged. They are already subtle and work on the light background.

### 8. Keep unchanged

- 3-column grid, hub size, orbit structure, connector animation logic
- All copy, card order, card content
- Section spacing, gradient transition band
- Headline text colors (already correct: slate-900 heading, AAC blue subline)
- Grid overlay (already at 0.02 opacity)

