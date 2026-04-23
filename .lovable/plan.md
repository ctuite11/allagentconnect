

## Buyer Search Filter Bar Parity — `BrowsePropertiesNew.tsx`

### Scope (locked)
- **Only file edited:** `src/pages/BrowsePropertiesNew.tsx`
- **Untouched:** `App.tsx`, route wiring, `BuyerSearch.tsx`, `BuyerLayout`, `BuyerPortalHeader`, `PropertyMap`, `UnifiedPropertySearch`, `ListingCard`, `buildListingsQuery`, all data fetching logic
- **No new files**, no new routes

### What changes

Replace the current filter bar with an inline pill-styled toolbar matching the local screenshot:

```text
[🔍 Search city/ZIP] [For Sale | For Rent] [Price ▾] [Beds & baths ▾] [Property type ▾] [⚙ More Filters] [Save Search] [Update]
```

### Implementation

**1. Add three inline `Popover` dropdowns** between the For Sale/Rent toggle and the More Filters button:

- **Price ▾**
  - Trigger: `h-9 rounded-full border-zinc-200 px-4 text-[13px]` + `ChevronDown`
  - Dynamic label: `"Price"` / `"$500k – $1M"` / `"Up to $1M"` / `"$500k+"`
  - Content: Min/Max `Input` fields + Reset / Apply buttons
  - On Apply: writes `criteria.minPrice`, `criteria.maxPrice`

- **Beds & baths ▾**
  - Dynamic label: `"Beds & baths"` / `"2+ bd, 1+ ba"`
  - Content: two segmented rows (`Any | 1+ | 2+ | 3+ | 4+ | 5+`) for bedrooms and bathrooms + Reset / Apply
  - On Apply: writes `criteria.bedrooms`, `criteria.bathrooms`

- **Property type ▾**
  - Dynamic label: `"Property type"` / `"3 selected"` / single name when one selected
  - Content: checkbox list (`single_family`, `condo`, `multi_family`, `townhouse`, `land`, `other`) + Reset / Apply
  - On Apply: writes `criteria.propertyTypes`

Each popover uses local draft state and only commits to `criteria` on Apply. Existing `useEffect` chain triggers `fetchListings()` automatically when `criteria` updates.

**2. Rename "Filters" → "More Filters"**
- Keep `SlidersHorizontal` icon and existing `Sheet` wrapping `UnifiedPropertySearch` for advanced filters
- Active count badge stays

**3. Pill styling pass**
- All trigger buttons: `h-9 rounded-full px-4 text-[13px]`
- Search input: `rounded-full pl-9 h-9` with `Search` icon at `left-3`
- For Sale/Rent toggle: `rounded-full` outer container, inner segments `rounded-full`, active = `bg-[#0E56F5] text-white`
- Save Search: ghost pill
- Update: `bg-[#0E56F5] hover:bg-[#0B46CC] rounded-full px-5`
- Outer flex gap: `gap-2.5`

**4. Strictly preserved**
- All `useState`, `useEffect`, `fetchListings`, `buildQueryParams`, URL hydration, `sessionStorage`, Supabase query, agent map fetch
- `forceBuyer` prop and conditional rendering (DCMLS branch + `ActiveAgentBanner`)
- Map panel (52/48 split, sticky `PropertyMap`)
- Results panel (header, sort, grid, `ListingCard`)
- `criteria` shape — new popovers write into existing fields, no schema changes

### Out of scope
- Google Maps "Oops" runtime error in screenshot (API key referrer config — not a layout fix; `PropertyMap.tsx` untouched per locked constraints)

### Acceptance
1. Filter bar visually matches local screenshot: search → toggle → 3 inline dropdowns → More Filters → Save Search → Update
2. Each dropdown writes to existing `criteria` and triggers refetch via existing effect
3. "More Filters" still opens the Sheet with full `UnifiedPropertySearch`
4. No changes to map, results grid, data fetching, route, or any other file
5. TypeScript clean

### Deliverables
- Single edit to `src/pages/BrowsePropertiesNew.tsx` (return block + 3 popover draft state hooks + minor imports: `Popover`, `Checkbox`, additional lucide icons)
- Confirmation no other files touched

