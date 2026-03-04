

## Grep Results

**"Contact the listing agent"** — found in **one** file: `src/components/PropertyDetailRightColumn.tsx` (line 667). Zero matches in `PropertyDetail.tsx` or `ConsumerPropertyDetail.tsx` — those are clean.

**"Interested in this property?"** — found in two files:
- `src/components/PropertyDetailRightColumn.tsx` (line 647) — the unsafe fallback
- `src/components/ContactAgentDialog.tsx` (line 196) — just placeholder text in a textarea, harmless

## The Leak

`PropertyDetailRightColumn.tsx` lines 643-674 contain the exact same unsafe fallback pattern you already deleted from `PropertyDetail.tsx`: a `!agent` card that says "Contact the listing agent" with a bare "Contact Agent" button.

**However**, this component is not imported anywhere. It's dead code — exported but never used by any page. So it's not actively rendering, but it's still a landmine waiting for someone to re-import it.

## Plan

**Single file: `src/components/PropertyDetailRightColumn.tsx`**

1. Delete lines 643-674 (the entire `{!agent && (...)}` fallback block)
2. Replace with the standard regression guard comment:
```
{/* ATTRIBUTION MASKING: No "Contact listing agent" fallback.
    Buyers redirect to /consumer-property/:id; non-agents see agent-only UI. */}
```

The `ContactAgentDialog.tsx` placeholder text ("I'm interested in this property and would like more information...") is fine — it's user-facing input placeholder inside a form that already uses the sticky agent ID, not listing-agent wording.

After this change, `grep -R "Contact the listing agent" src` will return zero results.

