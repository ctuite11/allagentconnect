DROP POLICY IF EXISTS "Authenticated users can upload agent match photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload agent match photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent-match-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND name ~* '\.(jpg|jpeg|png|webp|heic|heif)$'
);

DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
CREATE POLICY "Admins can upload brand assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND public.has_role(auth.uid(), 'admin')
  AND name ~* '\.(svg|png|jpg|jpeg|webp|gif)$'
);