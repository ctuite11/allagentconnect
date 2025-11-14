-- Add price range preferences to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS min_price numeric,
ADD COLUMN IF NOT EXISTS max_price numeric;

COMMENT ON COLUMN public.notification_preferences.min_price IS 'Minimum price for client need notifications';
COMMENT ON COLUMN public.notification_preferences.max_price IS 'Maximum price for client need notifications';