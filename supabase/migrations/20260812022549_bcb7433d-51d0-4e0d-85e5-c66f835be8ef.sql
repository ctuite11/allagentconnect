DROP POLICY IF EXISTS "message attachments select for conversation members" ON storage.objects;
DROP POLICY IF EXISTS "message attachments insert by conversation members" ON storage.objects;
DROP POLICY IF EXISTS "message attachments delete by uploader" ON storage.objects;

CREATE POLICY "message attachments select for conversation members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "message attachments insert by conversation members"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[2] = (auth.uid())::text
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "message attachments delete by uploader"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[2] = (auth.uid())::text
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);