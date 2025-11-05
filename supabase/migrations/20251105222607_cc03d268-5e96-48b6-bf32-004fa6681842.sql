-- Add new columns to teams table
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS team_photo_url TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"linkedin": "", "facebook": "", "twitter": "", "instagram": ""}'::jsonb;