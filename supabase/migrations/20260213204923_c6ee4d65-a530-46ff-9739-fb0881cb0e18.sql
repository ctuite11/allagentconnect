ALTER TABLE public.listings
  ADD COLUMN price_range_min numeric DEFAULT NULL,
  ADD COLUMN price_range_max numeric DEFAULT NULL;