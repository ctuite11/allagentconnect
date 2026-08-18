-- 1. agent-match-photos: require own-folder uploads
DROP POLICY IF EXISTS "Authenticated users can upload agent match photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload agent match photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent-match-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. brand-assets: admin-only inserts (service_role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated upload brand assets" ON storage.objects;
CREATE POLICY "Admins can upload brand assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- 3. client_needs: restrict reads to eligible agents, submitter, admins
DROP POLICY IF EXISTS "All authenticated users can view client needs" ON public.client_needs;
CREATE POLICY "Eligible agents, submitter, or admins can view client needs"
ON public.client_needs FOR SELECT TO authenticated
USING (
  public.current_is_eligible_agent()
  OR submitted_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

REVOKE ALL ON public.client_needs FROM anon;
GRANT SELECT, INSERT ON public.client_needs TO authenticated;
GRANT ALL ON public.client_needs TO service_role;