-- Add explicit boolean columns for price range semantics
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS has_no_min BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS has_no_max BOOLEAN DEFAULT true;

-- Update existing rows: if min_price is null, set has_no_min = true
UPDATE public.notification_preferences 
SET has_no_min = true 
WHERE min_price IS NULL AND has_no_min IS NULL;

-- Update existing rows: if max_price is null, set has_no_max = true
UPDATE public.notification_preferences 
SET has_no_max = true 
WHERE max_price IS NULL AND has_no_max IS NULL;

-- Update existing rows: if min_price has a value, set has_no_min = false
UPDATE public.notification_preferences 
SET has_no_min = false 
WHERE min_price IS NOT NULL AND has_no_min IS NULL;

-- Update existing rows: if max_price has a value, set has_no_max = false
UPDATE public.notification_preferences 
SET has_no_max = false 
WHERE max_price IS NOT NULL AND has_no_max IS NULL;