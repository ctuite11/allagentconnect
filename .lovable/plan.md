

# Swap "Add Comment" and Interest Signals positions in compact ListingCard

## Problem
Currently the footer row (line 722) shows: **Interest Signals (left)** | **Agent Attribution (right)**. The "Add Comment" button sits below that, separated from the agent info. The user wants "Add Comment" inline with the agent attribution row, and the buyer-saved signals moved down.

## Change — `src/components/ListingCard.tsx`

### Lines 721–803 — Restructure the footer area

**New order:**
1. **Comment + Attribution row** (border-t, mt-auto) — left side: Add Comment / chat preview / client comment; right side: agent attribution
2. **Interest Signals row** — below, no border, lighter treatment

This puts the comment action inline with the agent name, and moves the "X buyers saved" signals underneath.

### Specifically:
- Move the `onOpenChat` / chat preview / client comment blocks (lines 749–803) **into** the `mt-auto pt-2 border-t` row at line 722, on the left side
- Move `ListingInterestSignals` (lines 723–729) **below** that row as a standalone lighter row
- Keep `ListingAttribution` on the right side of the top footer row

### Result layout:
```text
┌─────────────────────────────┐
│ [image]                     │
│ address / price / stats     │
│ ─────────────────────────── │
│ 💬 Add Comment    Agent Co. │  ← comment + attribution row
│ 🔥 2 buyers saved           │  ← interest signals below
└─────────────────────────────┘
```

## Scope
Single file edit: `src/components/ListingCard.tsx`, compact mode section only (~lines 721–803).

