CREATE OR REPLACE FUNCTION public.can_write_listing_storage_folder(_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR _folder IS NULL THEN
    RETURN false;
  END IF;

  IF _folder = _uid::text THEN
    RETURN true;
  END IF;

  IF _folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = _folder::uuid
      AND public.matches_current_account(l.agent_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_listing_storage_folder(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_write_listing_storage_folder(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Agents can upload listing photos" ON storage.objects;
CREATE POLICY "Agents can upload listing photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-photos'
  AND public.can_write_listing_storage_folder((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "Agents can upload listing floor plans" ON storage.objects;
CREATE POLICY "Agents can upload listing floor plans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-floorplans'
  AND public.can_write_listing_storage_folder((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "Agents can upload listing documents" ON storage.objects;
CREATE POLICY "Agents can upload listing documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-documents'
  AND public.can_write_listing_storage_folder((storage.foldername(name))[1])
);