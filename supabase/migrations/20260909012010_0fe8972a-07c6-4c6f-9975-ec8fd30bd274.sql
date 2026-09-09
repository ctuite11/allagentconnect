DROP POLICY IF EXISTS "Authenticated users can view listing documents" ON storage.objects;

CREATE POLICY "Agent-side users can view listing documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listing-documents'
  AND (
    public.is_verified_agent()
    OR public.has_role(auth.uid(), 'admin')
  )
);