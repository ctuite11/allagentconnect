

# Ticket 15: DOM Rules, Clone Listing, and Back on Market

## Overview

This ticket codifies DOM (Days on Market) lifecycle rules, adds a "Clone Listing" action for agents to relist their own expired/cancelled listings as new market cycles, and adds `back_on_market` to agent-accessible status controls. No property history panel across agents (deferred to a future ticket).

---

## Scope Constraints

- Agents can only clone their **own** listings
- Clone is only available for listings in terminal statuses: `expired`, `cancelled`/`canceled`
- No auto-delete, no cross-agent cloning
- No Property History panel in this ticket (deferred)
- `AGING_RESET_DAYS = 30` (matches existing AgentDashboard reactivation logic)

---

## Implementation Details

### 1. Add `AGING_RESET_DAYS` constant

**File**: `src/constants/status.ts`

Add a single constant near the top of the listing section:

```text
export const AGING_RESET_DAYS = 30;
```

This centralizes the aging window used by both the existing `handleReactivate` in AgentDashboard and the new Clone logic. No other files need to import it yet (AgentDashboard can reference it later if desired), but it codifies the rule in the single source of truth.

### 2. Add `back_on_market` to edit-mode status options

**File**: `src/constants/status.ts`

Add `back_on_market` to `ADD_LISTING_EDIT_STATUSES` array (between `ACTIVE` and `PENDING`):

```text
{ value: LISTING_STATUS.BACK_ON_MARKET, label: LISTING_STATUS_LABELS[LISTING_STATUS.BACK_ON_MARKET] },
```

This allows agents to manually set a listing's status to "Back on Market" when editing, which keeps the same listing row and preserves DOM/history.

Also add `back_on_market` to the `PIPELINE_STATUSES` array in MyListings.tsx so it appears in the active pipeline filter:

**File**: `src/pages/MyListings.tsx` (line 40)

Change from:
```text
const PIPELINE_STATUSES: ListingStatus[] = ["active", "new", "coming_soon", "off_market"];
```
To:
```text
const PIPELINE_STATUSES = ["active", "new", "coming_soon", "off_market", "back_on_market"] as const;
```

And update the `ListingStatus` type on line 37 to include it.

### 3. Add "Clone Listing" action to AgentListingDetail

**File**: `src/pages/AgentListingDetail.tsx`

Add a "Clone as New Listing" button in the sticky header bar, visible only when:
- The current user's `auth.user.id` matches the listing's `agent_id`
- The listing status is `expired` or `cancelled`/`canceled`

Button appears alongside existing Edit/Preview/Share buttons.

**Clone behavior**:
1. Reads the current listing's property data
2. Navigates to `/agent/listings/new` with cloned data passed via `location.state`
3. The cloned payload includes property details but excludes lifecycle/history fields

**Fields INCLUDED in clone** (property data):
- address, unit_number, building_name, city, state, zip_code, county, neighborhood, town
- latitude, longitude
- property_type, listing_type
- bedrooms, bathrooms, square_feet, lot_size, year_built, floors
- description, additional_notes
- photos, floor_plans, documents (references to existing storage URLs)
- property_features, amenities, exterior_features_list, construction_features
- roof_materials, heating_types, cooling_types, green_features
- foundation_types, basement_types, basement_features_list, basement_floor_types
- waterfront, water_view, water_view_type, beach_nearby, facing_direction
- num_fireplaces, has_basement, garage_spaces, total_parking_spaces
- parking_features_list, parking_comments, garage_features_list, garage_comments, garage_additional_features_list
- handicap_access, handicap_accessible, lead_paint
- property_styles, outdoor_space, has_storage, laundry_type, pet_options, pets_comment, storage_options
- condo_details, multi_family_details, commercial_details
- area_amenities
- attom_data, walk_score_data, schools_data, value_estimate, attom_id
- annual_property_tax, tax_year, tax_assessment_value, assessed_value, fiscal_year, residential_exemption
- video_url, virtual_tour_url, property_website_url

**Fields EXCLUDED from clone** (lifecycle/history):
- id (new UUID generated)
- created_at, updated_at (new timestamps)
- status (set to `draft`)
- listing_number (new one assigned)
- active_date, list_date, activation_date, expiration_date
- go_live_date, auto_activate_on, auto_activate_days
- cancelled_at
- open_houses (fresh start)
- is_relisting (set to `true`)
- original_listing_id (set to the source listing's id)
- commission_rate, commission_type, commission_notes (agent may want to update)
- showing_instructions, lockbox_code, appointment_required, showing_contact_name, showing_contact_phone (may change)
- listing_agreement_types (new agreement)
- entry_only, lender_owned, short_sale (may change)
- disclosures, disclosures_other (may change)
- broker_comments, listing_exclusions
- rental_fee, rental_fee_text, deposit_requirements

### 4. Receive cloned data in AddListing

**File**: `src/pages/AddListing.tsx`

In the existing `AddListing` component, check for `location.state?.clonedListing` on mount. If present, pre-fill the form with the cloned data instead of starting empty. This follows the same pattern as the existing edit-mode load but with a fresh listing (no `listingId` param).

Key behaviors:
- Status defaults to `draft`
- No `listingId` or `draftId` set (ensures INSERT path, not UPDATE)
- The `original_listing_id` and `is_relisting: true` are included in the insert payload
- The agent can review and modify all fields before publishing
- On publish, standard listing creation flow runs (new row, new listing_number, status history logged as "Cloned from [original_id]")

### 5. Add "Clone" action to DraftListings-adjacent pages (expired/cancelled listings)

The Clone button only appears on the **AgentListingDetail** page since that's where agents view individual expired/cancelled listings. No action needed on MyListings because MyListings only shows pipeline statuses (active, new, coming_soon, off_market). Expired/cancelled listings are accessed via the AgentDashboard card list.

---

## What Does NOT Change

- No database migrations (columns `original_listing_id` and `is_relisting` already exist)
- No changes to `listing_status_history` or `listing_stats` tables
- No changes to the `update-listing-statuses` edge function
- No cross-agent Property History panel (deferred)
- No changes to the cron/auto-expiration logic
- No changes to DOM calculation logic (existing `cumulative_active_days` trigger handles it automatically)
- The existing `handleReactivate` in AgentDashboard continues to work as-is (within 30 days, same row, DOM continues)

---

## DOM Rules Summary (Codified)

| Scenario | What happens | DOM |
|----------|-------------|-----|
| Agent sets expired/withdrawn listing to `back_on_market` within 30 days | Same row, status change only | Continues (cumulative) |
| Agent reactivates cancelled listing within 30 days (existing AgentDashboard flow) | Same row, status -> active | Continues (cumulative) |
| Agent reactivates cancelled listing after 30 days (existing AgentDashboard flow) | Same row, `cumulative_active_days` reset to 0 | Resets |
| Agent clones expired/cancelled listing | New row, `is_relisting: true`, `original_listing_id` set | Starts at 0 |

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/constants/status.ts` | EDIT | Add `AGING_RESET_DAYS`, add `back_on_market` to edit statuses |
| `src/pages/MyListings.tsx` | EDIT | Add `back_on_market` to `PIPELINE_STATUSES` and `ListingStatus` type |
| `src/pages/AgentListingDetail.tsx` | EDIT | Add "Clone as New Listing" button for own expired/cancelled listings |
| `src/pages/AddListing.tsx` | EDIT | Accept `clonedListing` from location.state, pre-fill form, include `original_listing_id` and `is_relisting` in insert |

