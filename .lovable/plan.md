

# Plan: Add Breathing Room + Gradient Transition Before EcosystemSection

## Problem

The white `NetworkIntelligence` section cuts directly into the dark `EcosystemSection` with no visual transition — feels abrupt and crowded.

## Scope

Only modify: `src/components/home-v2/EcosystemSection.tsx`

Do not change: layout, cards, orbit, connectors, copy, or any other file.

## Changes

### 1. Add a gradient transition band above the section

Insert a `div` immediately before the existing `<section>` content (or wrap the section) that renders a light-to-dark gradient. This sits visually above the dark background and bridges the white section into the navy.

```
linear-gradient(to bottom, #ffffff 0%, #f8fafc 25%, #0a1024 65%, #050B1A 100%)
```

Height: ~160px. Positioned above the main section content using a negative-margin or an absolutely-positioned element at the top.

**Implementation**: Add a full-width gradient div as the first child of the section, positioned at the top with `absolute -top-[160px]` and `h-[160px]`, so it overlaps into the space above without affecting internal layout. The section itself gets `mt-[160px]` to create the physical space.

### 2. Increase section vertical padding

Change the section's `py-24` to `pt-36 pb-24` — adds ~48px more breathing room above the headline inside the dark area.

### 3. Increase headline bottom margin

Change `mb-16` on the headline container to `mb-20` for more space between the headline and the ecosystem grid.

## Summary

Three small tweaks: gradient transition band, more top padding, slightly more headline spacing. No layout or structural changes to the ecosystem itself.

