
-- 1. Create the stronger normalization function
CREATE OR REPLACE FUNCTION public.normalize_listing_address_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result text;
BEGIN
  IF input IS NULL OR trim(input) = '' THEN
    RETURN NULL;
  END IF;

  result := lower(trim(input));
  result := regexp_replace(result, '[.,;]', '', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  -- Street suffixes (word-boundary aware)
  result := regexp_replace(result, '\ystreet\y',    'st',   'g');
  result := regexp_replace(result, '\yavenue\y',    'ave',  'g');
  result := regexp_replace(result, '\yroad\y',      'rd',   'g');
  result := regexp_replace(result, '\yboulevard\y', 'blvd', 'g');
  result := regexp_replace(result, '\ylane\y',      'ln',   'g');
  result := regexp_replace(result, '\ydrive\y',     'dr',   'g');
  result := regexp_replace(result, '\ycourt\y',     'ct',   'g');
  result := regexp_replace(result, '\yplace\y',     'pl',   'g');
  result := regexp_replace(result, '\yterrace\y',   'ter',  'g');
  result := regexp_replace(result, '\yparkway\y',   'pkwy', 'g');
  result := regexp_replace(result, '\ycircle\y',    'cir',  'g');
  result := regexp_replace(result, '\yhighway\y',   'hwy',  'g');

  -- Unit markers
  result := regexp_replace(result, '\yapartment\y', 'unit', 'g');
  result := regexp_replace(result, '\yapt\y',       'unit', 'g');
  result := regexp_replace(result, '\ysuite\y',     'unit', 'g');
  result := regexp_replace(result, '\yste\y',       'unit', 'g');
  result := regexp_replace(result, '#(\s*)', 'unit ', 'g');

  -- Final cleanup
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  RETURN result;
END;
$$;

-- 2. Update trigger to use the new function
CREATE OR REPLACE FUNCTION public.normalize_listing_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.address_normalized := public.normalize_listing_address_text(NEW.address);
  RETURN NEW;
END;
$$;

-- 3. Backfill all existing rows
UPDATE listings
SET address_normalized = public.normalize_listing_address_text(address)
WHERE address IS NOT NULL;
