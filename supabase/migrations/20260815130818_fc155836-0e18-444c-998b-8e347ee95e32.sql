DROP POLICY IF EXISTS "Eligible agents read media on published developments" ON public.development_media;

CREATE POLICY "Eligible agents read media on published developments"
ON public.development_media
FOR SELECT
TO authenticated
USING (
  public.can_agent_view_development(development_id)
  AND (
    update_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.development_updates du
      WHERE du.id = development_media.update_id
        AND du.development_id = development_media.development_id
        AND du.is_published = true
    )
  )
);