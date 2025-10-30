-- Create storage buckets for listing files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('listing-photos', 'listing-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('listing-floorplans', 'listing-floorplans', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']),
  ('listing-documents', 'listing-documents', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- RLS policies for listing photos (public read, agents can upload their own)
CREATE POLICY "Anyone can view listing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-photos');

CREATE POLICY "Agents can upload listing photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'listing-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Agents can update their own listing photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'listing-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete their own listing photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'listing-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for floor plans
CREATE POLICY "Anyone can view listing floor plans"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-floorplans');

CREATE POLICY "Agents can upload listing floor plans"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'listing-floorplans' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Agents can update their own listing floor plans"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'listing-floorplans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete their own listing floor plans"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'listing-floorplans' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for documents (private, only for agents)
CREATE POLICY "Authenticated users can view listing documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Agents can upload listing documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'listing-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Agents can update their own listing documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'listing-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete their own listing documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'listing-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add columns to listings table for storing file metadata
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS floor_plans JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;