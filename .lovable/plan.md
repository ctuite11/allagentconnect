

## Buyer Search/Browse Parity Fix — `BrowsePropertiesNew.tsx`

### Scope (locked)
- **Only file edited:** `src/pages/BrowsePropertiesNew.tsx`
- **Untouched:** `App.tsx`, route wiring, `UnifiedPropertySearch`, `PropertyMap`, `buildListingsQuery`, `ListingCard`, DCMLS host helpers
- **No new files**, no new pages, no new routes

### Layout target

```text
┌─────────────────────────────────────────────────────────────┐
│  BuyerPortalHeader (already global on /client/* routes)      │
├─────────────────────────────────────────────────────────────┤
│  STICKY FILTER BAR  (top-14, white/90 + backdrop-blur)       │
│  [Search input] [For Sale|For Rent] [Price ▾] [Beds/Baths ▾]│
│  [Type ▾] [More Filters] [Save Search] [Update]              │
├──────────────────────────────┬──────────────────────────────┤
│                              │  RESULTS header (count+sort) │
│        MAP PANEL             │  ─────────────────────────── │
│   (sticky, lg:h-[calc])      │  Scrollable 2-col card grid  │
│                              │  using existing ListingCard  │
└──────────────────────────────┴──────────────────────────────┘
```

- **Desktop (lg+):** `grid-cols-[52%_48%]`, full-viewport-minus-header height, map sticky on left, results scroll on right
- **Mobile:** single column stacked — filter bar (collapsible advanced via existing `UnifiedPropertySearch` in a `Sheet`), map collapsed/hidden by default, results list below

### Implementation details

**1. Preserved (no changes to logic)**
- All `useState`, `useEffect`, `fetchListings`, `buildQueryParams`, `handleViewResults`
- `criteria` shape & defaults
- URL param hydration on mount
- `sessionStorage` persistence for `buyer_last_search_url`
- Supabase `buildListingsQuery` call + agent profile batch fetch
- `isDcmlsHost()` branching → DCMLS header + `dcmlsOnly` query flag
- `useUserRole` + `searchMode`
- `ListingCard` rendering with `agentInfo` mapping

**2. New layout structure (return block only)**
- Drop `pt-20`, `container`, `PageTitle` header block, and the 3-col grid
- Outer: `<div className="min-h-screen bg-white flex flex-col">`
- DCMLS branch keeps `<DcmlsConsumerHeader />`; non-DCMLS keeps `<ActiveAgentBanner />`
- **Sticky filter bar:** `sticky top-14 z-40 bg-white/90 backdrop-blur border-b border-zinc-200/60`
  - Inline compact controls: search input (zip/city), listing-type segmented toggle (For Sale / For Rent) styled to match buyer toolbar (`#0E56F5` active), price/beds-baths/type popovers using shadcn `Popover` + `Select`, "More Filters" button opens a `Sheet` containing the existing `<UnifiedPropertySearch>` component (no rewrite), Save Search button (toast placeholder — preserves "non-breaking"), Update button calls `fetchListings()`
  - Active filter count badge on More Filters
- **Main split:**
  - `<main className="mx-auto w-full max-w-[1800px] px-5 md:px-7 py-3">`
  - `<div className="grid grid-cols-1 lg:grid-cols-[52%_48%] gap-4 lg:h-[calc(100dvh-9rem)]">`
  - **Left (map):** rounded card with `<PropertyMap listings={listings} onListingClick={(id) => navigate('/property/'+id)} />` inside `lg:sticky lg:top-[7rem] lg:h-full`. Loading spinner / empty state / no-Google-Maps-key fallback
  - **Right (results):** rounded card, header row with results count + sort `Select` (recommended/newest/price asc/price desc — client-side `useMemo` sort), scrollable `lg:overflow-y-auto` with `grid grid-cols-1 md:grid-cols-2 gap-3` of existing `<ListingCard viewMode="compact">`
- **States preserved:** loading spinner, empty state with `Search` icon, map-unavailable graceful fallback

**3. Sort behavior (new, additive)**
- Local `sortBy` state (`"recommended" | "newest" | "price_asc" | "price_desc"`)
- `sortedListings = useMemo(...)` over `listings` — does not touch query

**4. Icons & spacing**
- All control buttons: `inline-flex items-center gap-1.5 h-9 px-3 text-[13px]`, lucide icons at `h-4 w-4`
- Active toggle: `bg-[#0E56F5] text-white`
- Inactive: `text-zinc-600 hover:text-zinc-900`

**5. Mobile (`<lg`)**
- Filter bar wraps; popover triggers remain tappable
- Map panel hidden by default, toggleable via a "Map" button OR shown at fixed `h-[50dvh]` above results (final: hidden on mobile, results-only — keeps "no overlap" guarantee)
- Results grid collapses to single column

**6. DCMLS preservation**
- `isDcmlsHost()` branch retained for header + `dcmlsOnly` flag
- DCMLS copy ("Off-market and coming-soon listings…") rendered as a thin subtitle row above the sticky filter bar when `dcmls === true`

### Files changed
- `src/pages/BrowsePropertiesNew.tsx` (return block + minor imports: add `Popover`, `Sheet`, `Select`, additional lucide icons, `useMemo`)

### Acceptance verification
1. `/client/search` continues to render `BrowsePropertiesNew` via existing `App.tsx` route — no route edits
2. Filters operate via existing `criteria` → `fetchListings` → `buildListingsQuery` pipeline (unchanged)
3. Desktop: sticky filters + 52/48 map/results split, both panels independently scroll where needed
4. Mobile: stacked controls + results list, no overlap with global `BuyerPortalHeader`
5. Property card click → `/property/:id` navigation preserved through `ListingCard`
6. Save Search remains a non-breaking placeholder (toast)
7. DCMLS host branch + `dcmlsOnly` query flag retained
8. TypeScript clean — only adds React hooks and shadcn imports already present in project

### Deliverables on implementation
- Edit to `src/pages/BrowsePropertiesNew.tsx` only
- Summary of layout/UI changes
- Confirmation that `App.tsx` and route wiring were not modified

