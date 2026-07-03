CREATE OR REPLACE FUNCTION public.current_account_owner_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  PERFORM public._purge_expired_agent_active_context();

  SELECT active_owner_user_id, expires_at
    INTO v_ctx, v_expires
  FROM public.agent_active_context
  WHERE user_id = v_uid;

  IF v_ctx IS NOT NULL THEN
    IF v_expires <= now() THEN
      DELETE FROM public.agent_active_context WHERE user_id = v_uid;
    ELSIF v_ctx = v_uid THEN
      RETURN v_ctx;
    ELSIF public.is_accepted_delegate_for(v_ctx) THEN
      RETURN v_ctx;
    ELSE
      DELETE FROM public.agent_active_context WHERE user_id = v_uid;
    END IF;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.agent_account_members m
  WHERE m.delegate_user_id = v_uid AND m.status = 'accepted';

  IF v_count = 1 THEN
    SELECT m.owner_user_id INTO v_single
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = v_uid AND m.status = 'accepted'
    LIMIT 1;
    RETURN v_single;
  END IF;

  IF public.is_licensed_owner() THEN
    RETURN v_uid;
  END IF;

  RETURN NULL;
END;
$function$;