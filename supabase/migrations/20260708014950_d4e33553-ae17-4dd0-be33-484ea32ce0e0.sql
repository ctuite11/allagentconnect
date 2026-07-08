CREATE OR REPLACE FUNCTION public.current_account_owner_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ctx uuid;
  v_expires timestamptz;
  v_count int;
  v_single uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_feature_enabled('agent_account_delegates') THEN
    RETURN v_uid;
  END IF;

  -- Read-only: do NOT purge or delete here. This function is invoked from
  -- RLS/views during SELECT (e.g. conversation_inbox), which runs in a
  -- read-only transaction. Expired/invalid rows are ignored on read and
  -- cleaned up separately by write/admin paths.
  SELECT active_owner_user_id, expires_at
    INTO v_ctx, v_expires
  FROM public.agent_active_context
  WHERE user_id = v_uid;

  IF v_ctx IS NOT NULL AND (v_expires IS NULL OR v_expires > now()) THEN
    IF v_ctx = v_uid THEN
      RETURN v_ctx;
    ELSIF public.is_accepted_delegate_for(v_ctx) THEN
      RETURN v_ctx;
    END IF;
    -- Otherwise fall through and ignore invalid context without deleting.
  END IF;

  SELECT count(*)::int
    INTO v_count
  FROM public.agent_account_members m
  WHERE m.delegate_user_id = v_uid
    AND m.status = 'accepted';

  IF v_count = 1 THEN
    SELECT m.owner_user_id
      INTO v_single
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = v_uid
      AND m.status = 'accepted'
    LIMIT 1;

    RETURN v_single;
  END IF;

  IF public.is_licensed_owner() THEN
    RETURN v_uid;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.current_account_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_account_owner_id() TO authenticated;