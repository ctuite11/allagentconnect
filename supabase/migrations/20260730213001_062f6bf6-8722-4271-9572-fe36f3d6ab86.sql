-- 1. hot_sheet_favorites: replace fully-open policies with participant checks
DROP POLICY IF EXISTS "Anyone can view favorites" ON public.hot_sheet_favorites;
DROP POLICY IF EXISTS "Anyone can add favorites" ON public.hot_sheet_favorites;
DROP POLICY IF EXISTS "Anyone can remove favorites" ON public.hot_sheet_favorites;

REVOKE ALL ON public.hot_sheet_favorites FROM anon;
GRANT SELECT, INSERT, DELETE ON public.hot_sheet_favorites TO authenticated;
GRANT ALL ON public.hot_sheet_favorites TO service_role;

ALTER TABLE public.hot_sheet_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hot sheet participants can view favorites"
  ON public.hot_sheet_favorites FOR SELECT TO authenticated
  USING (public.is_hot_sheet_participant(hot_sheet_id));

CREATE POLICY "Hot sheet participants can add favorites"
  ON public.hot_sheet_favorites FOR INSERT TO authenticated
  WITH CHECK (public.is_hot_sheet_participant(hot_sheet_id));

CREATE POLICY "Hot sheet participants can remove favorites"
  ON public.hot_sheet_favorites FOR DELETE TO authenticated
  USING (public.is_hot_sheet_participant(hot_sheet_id));

-- 2. rate_limits: enable RLS, service-role only
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

-- 3. email attachments: remove the blanket public SELECT policy on storage objects
DROP POLICY IF EXISTS "Email attachments are publicly readable" ON storage.objects;

CREATE POLICY "Users can browse their own email attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (
      (auth.uid())::text = (storage.foldername(name))[2]
      OR public.has_role(auth.uid(), 'admin')
    )
  );