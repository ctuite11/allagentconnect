-- =============================================================================
-- Delegate role routing: accepted membership is source of truth (not global flag)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_user_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin  boolean;
  v_is_agent  boolean;
  v_is_buyer  boolean;
  v_verified  boolean;
  v_is_delegate boolean;
  v_owner_id uuid;
  v_owner_first text;
  v_owner_last text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') INTO v_is_admin;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'agent') INTO v_is_agent;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'buyer') INTO v_is_buyer;

  IF v_is_agent THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agent_settings
      WHERE user_id = _user_id AND agent_status = 'verified'
    ) INTO v_verified;
  ELSE
    v_verified := false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agent_account_members m
    WHERE m.delegate_user_id = _user_id
      AND m.status = 'accepted'
  ) INTO v_is_delegate;

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true
    );
  END IF;

  IF v_is_agent AND v_verified THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', true,
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true
    );
  END IF;

  -- Accepted delegate membership routes to Success Hub even when global flag is off.
  IF v_is_delegate AND NOT (v_is_agent AND v_verified) THEN
    SELECT m.owner_user_id
      INTO v_owner_id
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = _user_id
      AND m.status = 'accepted'
    ORDER BY m.accepted_at DESC NULLS LAST
    LIMIT 1;

    SELECT ap.first_name, ap.last_name
      INTO v_owner_first, v_owner_last
    FROM public.agent_profiles ap
    WHERE ap.id = v_owner_id;

    RETURN jsonb_build_object(
      'role', 'delegate',
      'is_verified_agent', false,
      'is_licensed_owner', false,
      'is_delegate', true,
      'delegated_owner_user_id', v_owner_id,
      'active_owner_user_id', COALESCE(public.current_account_owner_id(), v_owner_id),
      'owner_display_name', nullif(trim(concat_ws(' ', v_owner_first, v_owner_last)), ''),
      'can_access_success_hub', true
    );
  END IF;

  IF v_is_agent THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', false
    );
  END IF;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false, 'can_access_success_hub', false);
  END IF;

  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false, 'can_access_success_hub', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO authenticated;
