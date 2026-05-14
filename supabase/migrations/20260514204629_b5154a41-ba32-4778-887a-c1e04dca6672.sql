
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Email attachments are publicly readable" ON storage.objects;
CREATE POLICY "Email attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "Authenticated users can upload email attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

DROP POLICY IF EXISTS "Users can update their own email attachments" ON storage.objects;
CREATE POLICY "Users can update their own email attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

DROP POLICY IF EXISTS "Users can delete their own email attachments" ON storage.objects;
CREATE POLICY "Users can delete their own email attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);
