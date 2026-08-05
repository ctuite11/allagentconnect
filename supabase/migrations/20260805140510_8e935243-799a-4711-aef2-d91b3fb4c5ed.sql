CREATE OR REPLACE FUNCTION public.admin_delete_pending_verification(
  p_id uuid,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_deleted_requests integer := 0;
  v_deleted_tombstones integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT lower(btrim(pv.email))
    INTO v_email
  FROM public.pending_verifications pv
  WHERE pv.id = p_id;

  IF v_email IS NULL AND p_email IS NOT NULL THEN
    v_email := lower(btrim(p_email));
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Verification request not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.pending_verifications pv
  WHERE pv.id = p_id OR lower(btrim(pv.email)) = v_email;
  GET DIAGNOSTICS v_deleted_requests = ROW_COUNT;

  -- A request-only identity must be fully re-invitable after deletion. Never
  -- erase permanent-agent history while an auth/profile identity still exists.
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email)
     AND NOT EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE lower(btrim(ap.email)) = v_email)
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(btrim(p.email)) = v_email)
  THEN
    DELETE FROM public.deleted_users d
    WHERE lower(btrim(d.email)) = v_email;
    GET DIAGNOSTICS v_deleted_tombstones = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'email', v_email,
    'deleted_requests', v_deleted_requests,
    'deleted_tombstones', v_deleted_tombstones,
    'fully_reinvitable', NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email
    ) AND NOT EXISTS (
      SELECT 1 FROM public.pending_verifications pv WHERE lower(btrim(pv.email)) = v_email
    ) AND NOT EXISTS (
      SELECT 1 FROM public.deleted_users d WHERE lower(btrim(d.email)) = v_email
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_pending_verification(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_pending_verification(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_pending_verification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_pending_verification(uuid, text) TO service_role;