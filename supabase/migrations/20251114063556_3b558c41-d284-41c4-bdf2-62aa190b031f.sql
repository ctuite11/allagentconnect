-- Add client needs notification settings columns to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS client_needs_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS client_needs_schedule text DEFAULT 'immediate' CHECK (client_needs_schedule IN ('immediate', 'daily', 'weekly'));