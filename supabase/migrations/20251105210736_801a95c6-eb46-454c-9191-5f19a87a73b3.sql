-- Add new columns to agent_profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS headshot_url text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS office_phone text,
ADD COLUMN IF NOT EXISTS cell_phone text,
ADD COLUMN IF NOT EXISTS office_name text,
ADD COLUMN IF NOT EXISTS office_address text;

-- Create storage buckets for agent headshots and logos
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('agent-headshots', 'agent-headshots', true),
  ('agent-logos', 'agent-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for agent-headshots bucket
CREATE POLICY "Agents can upload their own headshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-headshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can update their own headshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-headshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete their own headshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-headshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view agent headshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-headshots');

-- RLS policies for agent-logos bucket
CREATE POLICY "Agents can upload their own logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can update their own logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete their own logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view agent logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-logos');