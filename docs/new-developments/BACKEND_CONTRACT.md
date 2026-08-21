# New Developments — Backend Contract (post 2026-08-21 cleanup)

All values below are the **exact** stored strings. Labels are UI-only.

## public.developments

| Field | Type | Notes |
|---|---|---|
| `stage` | text NOT NULL, default `planning` | **renamed from `lifecycle_status`**. Physical construction only. |
| `sales_status` | text NOT NULL, default `not_yet_released` | **new**. Marketing state (Coming Soon / Now Selling live here). |
| `publish_status` | text NOT NULL, default `draft` | unchanged. AAC publication state. |
| `building_type` | text NULL | **new**, single-select. |
| `building_amenities` | text[] NOT NULL, default `{}` | **new**, multi-select checkboxes. |
| `amenities_notes` | text NULL | **new**, optional free text for "Other". |
| `amenities` | jsonb | **DEPRECATED** legacy free-text list. Read-only; do not write. |
| `expected_completion_year` | int NULL | 2000–2100. |
| `expected_completion_quarter` | int NULL | 1–4. Mutually exclusive with month. |
| `expected_completion_month` | int NULL | 1–12. Mutually exclusive with quarter. |
| `actual_completion_date` | date NULL | Only settable when `stage = 'completed'`. |
| `estimated_completion` | date | **DEPRECATED**, backfilled into year/month. |
| `delivery_from` / `delivery_to` | date | retained (optional delivery window). |

Allowed values:

- `stage`: `planning`, `pre_construction`, `under_construction`, `completed`
- `sales_status`: `not_yet_released`, `coming_soon`, `now_selling`, `final_units`, `sold_out`
- `publish_status`: `draft`, `pending_review`, `published`, `paused`, `archived`
- `building_type`: `high_rise`, `mid_rise`, `low_rise`, `garden_style`, `three_family`,
  `two_family`, `single_family`, `townhomes`, `condo_community`, `loft_conversion`,
  `brownstone`, `mixed_use`, `other`
- `building_amenities` (subset of): `concierge_doorman`, `elevator`, `fitness_center`, `pool`,
  `roof_deck`, `resident_lounge`, `business_center`, `package_room`, `bike_storage`,
  `garage_parking`, `ev_charging`, `storage`, `pet_friendly`, `dog_wash_pet_spa`,
  `common_outdoor_space`, `security`, `other`

## public.development_units

Existing: `unit_number`, `floor` (text), `beds` (numeric), `baths` (numeric), `sqft` (int),
`price` (numeric), `status`, `floor_plan_id`, `building_phase_id`, `description`,
`views_exposure`, `parking_spaces`, `parking_notes`, `outdoor_space`, `incentives`,
`estimated_delivery` (date), `is_featured`, `sort_order`.

New: `unit_type` (text NULL), `price_min` / `price_max` (numeric NULL, min ≤ max, ≥ 0),
`unit_features` (text[] NOT NULL default `{}`).

- `status`: `not_released`, `coming_soon`, `available`, `reserved`, `under_agreement`, `sold`
  (added `not_released`)
- `unit_type`: `studio`, `flat`, `duplex`, `triplex`, `loft`, `penthouse`, `townhome`,
  `live_work`, `commercial`
- `unit_features` (subset of): `balcony`, `terrace`, `private_roof_deck`, `in_unit_laundry`,
  `central_air`, `fireplace`, `walk_in_closet`, `floor_to_ceiling_windows`, `water_views`,
  `city_views`, `garage_parking`, `ev_charging`, `private_elevator`, `smart_home`, `storage`,
  `other`

Photos / floor plan images: `public.development_media` rows with `unit_id` or `floor_plan_id` set
(`kind`, `storage_bucket`/`storage_path` or `external_url`, `is_hero`, `sort_order`).

## public.development_floor_plans

Existing: `name`, `description`, `beds`, `baths`, `sqft_min`, `sqft_max`, `price_min`,
`price_max`, `features` (jsonb, deprecated), `is_active`, `sort_order`.
New: `unit_type` (same list as units), `unit_features` (text[], same list).

## Data conversion performed

- `lifecycle_status` → `stage`; `coming_soon` → `planning` (+ `sales_status = coming_soon`),
  `now_selling` → `under_construction` (+ `sales_status = now_selling`).
- `estimated_completion` backfilled into `expected_completion_year` / `_month`.
- Free-text `amenities` best-effort mapped into `building_amenities`; originals preserved.
- 2 developments, 6 units, 2 floor plans — no records deleted.

TypeScript constants: `src/lib/developments/publishStatus.ts`
(`DEVELOPMENT_STAGES`, `DEVELOPMENT_SALES_STATUSES`, `DEVELOPMENT_BUILDING_TYPES`,
`DEVELOPMENT_BUILDING_AMENITIES`, `DEVELOPMENT_UNIT_FEATURES`, `DEVELOPMENT_UNIT_TYPES`,
`DEVELOPMENT_UNIT_STATUSES`).
