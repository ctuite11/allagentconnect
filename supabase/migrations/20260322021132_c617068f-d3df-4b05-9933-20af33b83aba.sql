INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read brand assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'brand-assets');

CREATE POLICY "Authenticated upload brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets');