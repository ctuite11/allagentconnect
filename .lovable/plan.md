

# Plan: Add Back Constellation Lines (No Nodes)

## Scope
Modify only `src/components/home-v2/EcosystemSection.tsx`

## What

The original `ConstellationBackground` had 30 randomly placed SVG lines creating a network-web effect. These were removed along with the dots/nodes. The user wants the lines back — but no dots, no wake nodes, no glow.

## Change

Add an SVG layer inside the section (before the grid overlay) that renders 30 random connecting lines, adapted for the light theme:

- **Lines only** — no dots, no nodes, no wake effects, no `AnimatePresence`
- Stroke color: `rgba(148,163,184,0.12)` (silver-gray, consistent with the light palette)
- Stroke width: `0.5`
- 30 lines with random start/end positions (same `useMemo` pattern from the original)
- Render as an absolutely positioned SVG behind the content

This is a ~15-line addition inline in `EcosystemSection.tsx` — no need to re-import `ConstellationBackground`. We'll add `useMemo` to the imports and place the SVG between the gradient transition band and the grid overlay.

