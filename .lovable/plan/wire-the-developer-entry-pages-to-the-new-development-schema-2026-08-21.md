# Wire the Developer entry pages to the new development schema

## What's going on

The schema cleanup landed in the database — `stage`, `sales_status`, `building_type`, `building_amenities`, `expected_completion_year/quarter/month`, `actual_completion_date`, and unit-level `unit_type`, `unit_features`, `price_min`/`price_max` all exist. The developer-facing pages were never updated: the Details page still edits the old free-form `estimated_completion` field and shows no Status, Building Type, or Amenities controls. That's why nothing looks different after logging in.

The UI work was originally set aside to hand to Cursor. This plan builds it here instead.

## What gets built

### Project Details page
Reorganized into Add-Listing-style sections:

- **Project basics** — name, developer/architect/designer, description, highlights
- **Location** — address via the standard address autocomplete, neighborhood
- **Stage & availability**
  - Stage (single-select): Planning, Pre-Construction, Under Construction, Completed
  - Sales status (single-select): Not Yet Released, Coming Soon, Now Selling, Final Units, Sold Out
  - Expected completion: year + quarter (or month) pickers instead of a free-text date
  - Completion date: shown only when Stage is Completed
- **Building** — Building type single-select (High Rise, Mid Rise, Low Rise, 3 Family, 2 Family, Single Family, Townhomes, Condo Community, Mixed Use); Building amenities as a checkbox grid (Concierge/Doorman, Elevator, Fitness Center, Pool, Roof Deck, Resident Lounge, Business Center, Package Room, Bike Storage, Garage Parking, EV Charging, Storage, Pet Friendly, Dog Wash/Pet Spa, Common Outdoor Space, Security, Other)
- **Terms** — HOA, parking, pet policy, deposits, incentives, buyer-agent compensation (unchanged fields, regrouped)

The AAC publish state (Draft / Pending Review / Published / Paused / Archived) stays where it is today — the badge and Submit/Withdraw buttons in the page header — and is not duplicated as a form field.

### Units page
- Unit type single-select and Unit features checkbox grid (Balcony, Terrace, Private Roof Deck, In-Unit Laundry, Central Air, Fireplace, Walk-In Closet, Floor-to-Ceiling Windows, Water Views, City Views, Garage Parking, EV Charging, Private Elevator, Smart Home, Storage, Other)
- Price min/max range fields alongside the existing single price
- Existing unit number, beds, baths, sqft, floor, status, floor plan and photo links stay as they are

### Public development page
Stage and sales status render as separate labels; building type and amenities appear in the detail sections; completion shows the structured expected date, or the actual completion date for finished projects.

## Technical notes

- New shared constants file for building types, building amenities, unit types, and unit features so the entry UI, the public page, and future filters read from one list.
- No migration needed — all columns exist. `estimated_completion` stays in the table as legacy and is read only as a fallback for display until the two existing projects are re-entered.
- Pages touched: `DeveloperDetailsPage`, `DeveloperUnitsPage`, `DeveloperCreateDevelopmentPage`, plus the development detail/card components and `src/lib/developments/format.ts`.
- No changes to publish-status transitions, RLS, media, documents, or team.
