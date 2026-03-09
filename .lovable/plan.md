

# Fix SearchListingCard: Layout + Missing Data

## Problems identified

1. **Agent phone/email never show** — Data field mismatch. `ListingSearchResults` maps to `list_agent_phone` / `list_agent_email`, but `SearchListingCard` reads `agent_phone` / `agent_email`. They never match.

2. **Office phone missing** — `agent_profiles.office_phone` exists in the database but is never fetched in the search query.

3. **Big gap below neighborhood** — The info row (Listing # + property type) at line 315 has `mt-2` creating unnecessary space. Should be tighter, `mt-1`.

4. **Listing # and property type don't align well** — They're in a separate flex row with `gap-3` but feel disconnected. Should use a separator dot and tighter spacing.

5. **Status not truly centered** — The address block has `flex-1` but the price block is `flex-shrink-0`, so status drifts. Both address and price need `flex-1` so status centers between them.

## Changes

### File 1: `src/pages/ListingSearchResults.tsx` (lines 207-229)

**Fix the query** — add `office_phone` to the select:
```
.select("id, first_name, last_name, email, phone, cell_phone, office_name, office_phone")
```

**Fix the mapping** — use field names that SearchListingCard expects:
```tsx
agent_name: agentInfo?.name || null,
agent_email: agentInfo?.email || null,       // was list_agent_email
agent_phone: agentInfo?.phone || null,       // was list_agent_phone
list_office: agentInfo?.office || null,
list_office_phone: agentInfo?.officePhone || null,  // NEW
```

### File 2: `src/components/listing-search/ListingResultsTable.tsx` (lines 43-44)

Update the `Listing` interface to match:
```tsx
agent_phone?: string;      // was list_agent_phone
agent_email?: string;      // was list_agent_email
list_office_phone?: string; // NEW
```

### File 3: `src/components/listing-search/SearchListingCard.tsx`

**Interface** — add `list_office_phone?: string | null` to `SearchListing`.

**Layout fixes (desktop):**

- **Header row (line 265):** Give the price block `flex-1 text-right` (same as address block `flex-1`) so the status block centers evenly between them.

- **Info row (line 315):** Reduce `mt-2` to `mt-1`. Join listing # and property type with a dot separator instead of gap-3 flex.

- **Attribution row:** Add office phone display next to `list_office` name. The phone and email for agent are already coded — they just weren't receiving data due to the field name bug.

**No other files change.** No shell changes. No ListingCard changes.

## Result

```text
[PHOTO]  10 North Mead St          Status: New          $2,000,000
         Boston, MA 02129                                $853/sqft
         Charlestown                                     List Date: 01/15/26
         Listing #L-1182 · Single Family                 DOM: 4

         4 Beds   3 Baths   2,345 sqft
         Built 1987 · 3 pkg

         ────────────────────────────────────────────────────────────────
         List Office: Compass (617) 555-1111    List Agent: Chris Tuite (617) 555-2222 chris@compass.com [Contact]
```

