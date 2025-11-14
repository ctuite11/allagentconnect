-- Add property type preferences to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS property_types jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.notification_preferences.property_types IS 'Array of property types agent wants notifications for (e.g., ["single_family", "condo"]). Empty array means all types.';