

# Fix Edit Return Navigation — Preserve Original Listing Origin

## Problem
AgentListingDetail hardcodes `{ state: { from: '/listing/${id}' } }` instead of using the actual current path. PropertyDetail and PropertyDetailRightColumn don't pass `state.from` at all. This breaks the chain: Search Results → Listing → Edit → Save should return to Listing (preserving search context).

## Changes

### 1. AgentListingDetail.tsx (line 379)
Replace hardcoded `/listing/${id}` with dynamic `location.pathname + location.search`:
```tsx
onClick={() => navigate(`/agent/listings/edit/${id}`, { state: { from: location.pathname + location.search } })}
```

### 2. PropertyDetail.tsx (line 827)
Add origin state:
```tsx
onClick={() => navigate(`/agent/listings/edit/${id}`, { state: { from: location.pathname + location.search } })}
```

### 3. PropertyDetailRightColumn.tsx (line 208)
This component receives `listing` as a prop but needs `location`. Add `useLocation()` import and pass origin state:
```tsx
onClick={() => navigate(`/agent/listings/edit/${listing.id}`, { state: { from: location.pathname + location.search } })}
```

### 4. AddListing.tsx — already correct
- Line 2448-2452: `handleSaveChanges` already checks `location.state?.from` and navigates there.
- Line 2825-2827: `handleSubmit` (publish) also checks `location.state?.from`.
- Line 2249: Draft save navigates to `MY_LISTINGS?status=draft` — this is intentional for new drafts, no change needed.
- Line 2862: Back button hardcodes `/agent/listings` — update to also respect `location.state?.from`.

### 5. AddListing.tsx back button (line 2862)
Make back button origin-aware:
```tsx
onClick={() => navigate(location.state?.from || "/agent/listings")}
```

## No changes to
- Save logic, status handling, other navigation flows, sidebar, routing

## Expected result
- Search Results → Listing → Edit → Save → same Listing page
- Back button on edit page → returns to listing page
- History preserved so listing page back button → Search Results

