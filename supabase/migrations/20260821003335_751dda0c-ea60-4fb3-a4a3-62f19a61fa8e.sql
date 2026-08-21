-- ============================================================
-- New Developments: structured backend contract
-- Stage / Sales status / Publish status / Completion split
-- Structured building type, amenities, unit features
-- ============================================================

-- ---------- 1. STAGE ----------
ALTER TABLE public.developments DROP CONSTRAINT IF EXISTS developments_lifecycle_status_check;
ALTER TABLE public.developments RENAME COLUMN lifecycle_status TO stage;
ALTER TABLE public.developments ALTER COLUMN stage DROP DEFAULT;

UPDATE public.developments SET stage = 'planning' WHERE stage = 'coming_soon';
UPDATE public.developments SET stage = 'under_construction' WHERE stage = 'now_selling';

ALTER TABLE public.developments ALTER COLUMN stage SET DEFAULT 'planning';
ALTER TABLE public.developments
  ADD CONSTRAINT developments_stage_check
  CHECK (stage IN ('planning','pre_construction','under_construction','completed'));

-- ---------- 2. SALES STATUS (marketing, separate from stage) ----------
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS sales_status text NOT NULL DEFAULT 'not_yet_released';

UPDATE public.developments SET sales_status = 'now_selling'
  WHERE id = 'd0000000-0000-4000-8000-000000000001';
UPDATE public.developments SET sales_status = 'coming_soon'
  WHERE id = '356d2ddc-4ac1-4c86-b37c-3209b26c26b1';

ALTER TABLE public.developments
  ADD CONSTRAINT developments_sales_status_check
  CHECK (sales_status IN ('not_yet_released','coming_soon','now_selling','final_units','sold_out'));

-- ---------- 3. COMPLETION ----------
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS expected_completion_year integer,
  ADD COLUMN IF NOT EXISTS expected_completion_quarter integer,
  ADD COLUMN IF NOT EXISTS expected_completion_month integer,
  ADD COLUMN IF NOT EXISTS actual_completion_date date;

UPDATE public.developments
  SET expected_completion_year = EXTRACT(YEAR FROM estimated_completion)::int,
      expected_completion_month = EXTRACT(MONTH FROM estimated_completion)::int
  WHERE estimated_completion IS NOT NULL
    AND expected_completion_year IS NULL;

ALTER TABLE public.developments
  ADD CONSTRAINT developments_expected_completion_year_check
    CHECK (expected_completion_year IS NULL OR (expected_completion_year BETWEEN 2000 AND 2100)),
  ADD CONSTRAINT developments_expected_completion_quarter_check
    CHECK (expected_completion_quarter IS NULL OR (expected_completion_quarter BETWEEN 1 AND 4)),
  ADD CONSTRAINT developments_expected_completion_month_check
    CHECK (expected_completion_month IS NULL OR (expected_completion_month BETWEEN 1 AND 12)),
  ADD CONSTRAINT developments_expected_completion_precision_check
    CHECK (expected_completion_quarter IS NULL OR expected_completion_month IS NULL),
  ADD CONSTRAINT developments_expected_completion_requires_year_check
    CHECK (expected_completion_year IS NOT NULL
           OR (expected_completion_quarter IS NULL AND expected_completion_month IS NULL)),
  ADD CONSTRAINT developments_actual_completion_requires_completed_check
    CHECK (actual_completion_date IS NULL OR stage = 'completed');

-- ---------- 4. BUILDING TYPE ----------
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS building_type text;

ALTER TABLE public.developments
  ADD CONSTRAINT developments_building_type_check
  CHECK (building_type IS NULL OR building_type IN (
    'high_rise','mid_rise','low_rise','garden_style','three_family','two_family',
    'single_family','townhomes','condo_community','loft_conversion','brownstone',
    'mixed_use','other'
  ));

-- ---------- 5. BUILDING AMENITIES (structured multi-select) ----------
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS building_amenities text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.developments
  ADD CONSTRAINT developments_building_amenities_check
  CHECK (building_amenities <@ ARRAY[
    'concierge_doorman','elevator','fitness_center','pool','roof_deck','resident_lounge',
    'business_center','package_room','bike_storage','garage_parking','ev_charging','storage',
    'pet_friendly','dog_wash_pet_spa','common_outdoor_space','security','other'
  ]::text[]);

-- best-effort backfill from legacy free-text amenities jsonb
UPDATE public.developments d
SET building_amenities = sub.mapped
FROM (
  SELECT d2.id,
         COALESCE(array_agg(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL), '{}'::text[]) AS mapped
  FROM public.developments d2
  LEFT JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(d2.amenities) = 'array' THEN d2.amenities ELSE '[]'::jsonb END
  ) AS a(txt) ON true
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN a.txt ILIKE '%concierge%' OR a.txt ILIKE '%doorman%' THEN 'concierge_doorman'
      WHEN a.txt ILIKE '%elevator%' THEN 'elevator'
      WHEN a.txt ILIKE '%fitness%' OR a.txt ILIKE '%gym%' THEN 'fitness_center'
      WHEN a.txt ILIKE '%pool%' THEN 'pool'
      WHEN a.txt ILIKE '%roof%' THEN 'roof_deck'
      WHEN a.txt ILIKE '%lounge%' THEN 'resident_lounge'
      WHEN a.txt ILIKE '%business%' OR a.txt ILIKE '%co-work%' OR a.txt ILIKE '%cowork%' THEN 'business_center'
      WHEN a.txt ILIKE '%package%' THEN 'package_room'
      WHEN a.txt ILIKE '%bike%' THEN 'bike_storage'
      WHEN a.txt ILIKE '%garage%' OR a.txt ILIKE '%parking%' THEN 'garage_parking'
      WHEN a.txt ILIKE '%ev %' OR a.txt ILIKE '%charging%' THEN 'ev_charging'
      WHEN a.txt ILIKE '%storage%' THEN 'storage'
      WHEN a.txt ILIKE '%pet spa%' OR a.txt ILIKE '%dog wash%' THEN 'dog_wash_pet_spa'
      WHEN a.txt ILIKE '%pet%' THEN 'pet_friendly'
      WHEN a.txt ILIKE '%terrace%' OR a.txt ILIKE '%courtyard%' OR a.txt ILIKE '%outdoor%' THEN 'common_outdoor_space'
      WHEN a.txt ILIKE '%security%' THEN 'security'
      ELSE NULL
    END AS code
  ) m ON true
  GROUP BY d2.id
) sub
WHERE d.id = sub.id AND d.building_amenities = '{}'::text[];

COMMENT ON COLUMN public.developments.amenities IS 'DEPRECATED free-form amenity strings. Use building_amenities (structured multi-select) plus amenities_notes.';
ALTER TABLE public.developments ADD COLUMN IF NOT EXISTS amenities_notes text;
COMMENT ON COLUMN public.developments.estimated_completion IS 'DEPRECATED. Use expected_completion_year + expected_completion_quarter/month and actual_completion_date.';

-- ---------- 6. UNIT FEATURES + UNIT MODEL ----------
ALTER TABLE public.development_units
  ADD COLUMN IF NOT EXISTS unit_features text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS price_min numeric,
  ADD COLUMN IF NOT EXISTS price_max numeric;

ALTER TABLE public.development_floor_plans
  ADD COLUMN IF NOT EXISTS unit_features text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS unit_type text;

ALTER TABLE public.development_units
  ADD CONSTRAINT development_units_unit_features_check
  CHECK (unit_features <@ ARRAY[
    'balcony','terrace','private_roof_deck','in_unit_laundry','central_air','fireplace',
    'walk_in_closet','floor_to_ceiling_windows','water_views','city_views','garage_parking',
    'ev_charging','private_elevator','smart_home','storage','other'
  ]::text[]),
  ADD CONSTRAINT development_units_unit_type_check
  CHECK (unit_type IS NULL OR unit_type IN (
    'studio','flat','duplex','triplex','loft','penthouse','townhome','live_work','commercial'
  )),
  ADD CONSTRAINT development_units_price_range_check
  CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max),
  ADD CONSTRAINT development_units_price_min_check CHECK (price_min IS NULL OR price_min >= 0),
  ADD CONSTRAINT development_units_price_max_check CHECK (price_max IS NULL OR price_max >= 0);

ALTER TABLE public.development_floor_plans
  ADD CONSTRAINT development_floor_plans_unit_features_check
  CHECK (unit_features <@ ARRAY[
    'balcony','terrace','private_roof_deck','in_unit_laundry','central_air','fireplace',
    'walk_in_closet','floor_to_ceiling_windows','water_views','city_views','garage_parking',
    'ev_charging','private_elevator','smart_home','storage','other'
  ]::text[]),
  ADD CONSTRAINT development_floor_plans_unit_type_check
  CHECK (unit_type IS NULL OR unit_type IN (
    'studio','flat','duplex','triplex','loft','penthouse','townhome','live_work','commercial'
  ));

-- availability status: add not_released
ALTER TABLE public.development_units DROP CONSTRAINT IF EXISTS development_units_status_check;
ALTER TABLE public.development_units
  ADD CONSTRAINT development_units_status_check
  CHECK (status IN ('not_released','coming_soon','available','reserved','under_agreement','sold'));

-- ---------- 7. GRANTS for new columns (column-level grants exist on child tables) ----------
GRANT INSERT (unit_features, unit_type, price_min, price_max),
      UPDATE (unit_features, unit_type, price_min, price_max)
  ON public.development_units TO authenticated;
GRANT INSERT (unit_features, unit_type), UPDATE (unit_features, unit_type)
  ON public.development_floor_plans TO authenticated;
