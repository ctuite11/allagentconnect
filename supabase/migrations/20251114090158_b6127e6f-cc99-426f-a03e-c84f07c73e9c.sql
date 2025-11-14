-- Add office fields to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS office_name text,
ADD COLUMN IF NOT EXISTS office_address text,
ADD COLUMN IF NOT EXISTS office_phone text;